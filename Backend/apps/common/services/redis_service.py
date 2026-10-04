"""
Redis Service: Distributed Locking, Concurrency Control, and Rate Limiting.

Provides robust, high-performance distributed synchronization primitives:
- Distributed Lock (`acquire_lock`, `release_lock`, `redis_lock` context manager)
- Concurrency Slot Limiter (`acquire_concurrency_slot`, `release_concurrency_slot`)
- Rate Limiter (`check_rate_limit`, `increment_successful_counter`)

Designed with clean architecture and graceful fallbacks for local dev / testing
when Redis is unreachable or running with LocMemCache.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Generator
from contextlib import contextmanager

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Lua script for safe distributed lock release (atomically verifies token before deleting)
_RELEASE_LOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""

# Lua script for atomic concurrency slot acquisition with TTL
_ACQUIRE_CONCURRENCY_LUA = """
local current = tonumber(redis.call("get", KEYS[1]) or "0")
local max_slots = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

if current < max_slots then
    local new_val = redis.call("incr", KEYS[1])
    redis.call("expire", KEYS[1], ttl)
    return new_val
else
    return -1
end
"""

# Lua script for atomic concurrency slot release
_RELEASE_CONCURRENCY_LUA = """
local current = tonumber(redis.call("get", KEYS[1]) or "0")
if current > 0 then
    return redis.call("decr", KEYS[1])
else
    redis.call("set", KEYS[1], "0")
    return 0
end
"""


_redis_last_check = 0.0
_redis_cached_client = None


def _get_raw_redis_client():
    """
    Attempts to retrieve a direct Redis client instance.
    Checks django-redis / RedisCache client or instantiates from settings.
    Returns None if Redis is not configured or unreachable.
    """
    global _redis_last_check, _redis_cached_client
    now = time.monotonic()
    if _redis_cached_client is not None:
        return _redis_cached_client

    if now - _redis_last_check < 5.0:
        return None

    _redis_last_check = now
    try:
        # Django 4/5 redis cache backend
        if hasattr(cache, "_cache") and hasattr(cache._cache, "get_client"):
            client = cache._cache.get_client()
            client.ping()
            _redis_cached_client = client
            return client
        if hasattr(cache, "client") and hasattr(cache.client, "get_client"):
            client = cache.client.get_client()
            client.ping()
            _redis_cached_client = client
            return client

        redis_url = getattr(settings, "REDIS_URL", None) or getattr(settings, "CELERY_BROKER_URL", None)
        if redis_url and redis_url.startswith("redis"):
            import redis

            client = redis.Redis.from_url(redis_url, socket_connect_timeout=0.1, socket_timeout=0.1)
            client.ping()
            _redis_cached_client = client
            return client
    except Exception as exc:
        logger.debug("Raw Redis client connection skipped: %s", exc)
    return None


# ---------------------------------------------------------------------------
# 1. Distributed Lock
# ---------------------------------------------------------------------------


def acquire_lock(key: str, token: str | None = None, expire: int = 60, timeout: float = 0.0) -> str | None:
    """
    Acquires a distributed lock for `key`.

    Args:
        key: Unique lock identifier (prefixed with 'lock:').
        token: Unique caller token. If None, auto-generates a UUID4 string.
        expire: Lock TTL in seconds (auto-expires to prevent deadlocks).
        timeout: Maximum seconds to wait/retry acquiring the lock (0 for non-blocking).

    Returns:
        The token string if lock was successfully acquired, or None if lock could not be acquired.
    """
    lock_key = f"lock:{key}"
    token_str = token or uuid.uuid4().hex
    start_time = time.monotonic()
    client = _get_raw_redis_client()

    while True:
        try:
            if client:
                acquired = client.set(lock_key, token_str, nx=True, ex=expire)
                if acquired:
                    return token_str
            else:
                # Fallback using standard Django cache
                acquired = cache.add(lock_key, token_str, timeout=expire)
                if acquired:
                    return token_str
        except Exception as exc:
            logger.warning("Redis distributed lock error on key '%s': %s. Falling back gracefully.", lock_key, exc)
            # Local dev fallback: try cache before giving up
            try:
                if cache.add(lock_key, token_str, timeout=expire):
                    return token_str
            except Exception:
                return token_str

        if timeout <= 0 or (time.monotonic() - start_time) >= timeout:
            break

        time.sleep(0.05)

    return None


def release_lock(key: str, token: str) -> bool:
    """
    Releases a distributed lock for `key` only if the token matches.

    Args:
        key: Unique lock identifier.
        token: The token returned when the lock was acquired.

    Returns:
        True if lock was released, False otherwise.
    """
    lock_key = f"lock:{key}"
    client = _get_raw_redis_client()

    try:
        if client:
            res = client.eval(_RELEASE_LOCK_LUA, 1, lock_key, token)
            return bool(res)
        else:
            current_val = cache.get(lock_key)
            if current_val == token:
                cache.delete(lock_key)
                return True
            return False
    except Exception as exc:
        logger.warning("Error releasing Redis lock on key '%s': %s", lock_key, exc)
        try:
            current_val = cache.get(lock_key)
            if current_val == token:
                cache.delete(lock_key)
                return True
        except Exception:
            pass
        return False


@contextmanager
def redis_lock(key: str, expire: int = 60, timeout: float = 5.0) -> Generator[str | None, None, None]:
    """
    Context manager for distributed locking.

    Usage:
        with redis_lock("exam_start:user_1:exam_2", expire=10) as token:
            if not token:
                raise ConflictException("Another request is processing this exam attempt")
            # critical section
    """
    token = acquire_lock(key=key, expire=expire, timeout=timeout)
    try:
        yield token
    finally:
        if token:
            release_lock(key=key, token=token)


# ---------------------------------------------------------------------------
# 2. Concurrency Slot Limiter
# ---------------------------------------------------------------------------


def acquire_concurrency_slot(slot_key: str, max_slots: int = 3, timeout_seconds: int = 60) -> bool:
    """
    Atomically attempts to acquire a concurrency slot out of `max_slots`.
    Used e.g. for resource-heavy PDF stamping (max 3 concurrent jobs).

    Args:
        slot_key: Name of the resource / pool.
        max_slots: Maximum concurrent slots allowed (default: 3).
        timeout_seconds: TTL safety reset for the counter.

    Returns:
        True if a slot was granted, False if max_slots limit is reached.
    """
    redis_key = f"concurrency_slots:{slot_key}"
    client = _get_raw_redis_client()

    try:
        if client:
            res = client.eval(_ACQUIRE_CONCURRENCY_LUA, 1, redis_key, max_slots, timeout_seconds)
            return int(res) > 0
        else:
            # Fallback with cache
            current = int(cache.get(redis_key, 0) or 0)
            if current < max_slots:
                try:
                    cache.incr(redis_key)
                except ValueError:
                    cache.set(redis_key, 1, timeout=timeout_seconds)
                return True
            return False
    except Exception as exc:
        logger.warning("Concurrency slot check failed on '%s': %s. Permitting execution.", redis_key, exc)
        return True


def release_concurrency_slot(slot_key: str) -> None:
    """
    Releases an acquired concurrency slot.
    """
    redis_key = f"concurrency_slots:{slot_key}"
    client = _get_raw_redis_client()

    try:
        if client:
            client.eval(_RELEASE_CONCURRENCY_LUA, 1, redis_key)
        else:
            try:
                current = int(cache.get(redis_key, 0) or 0)
                if current > 0:
                    cache.decr(redis_key)
                else:
                    cache.set(redis_key, 0, timeout=300)
            except Exception:
                cache.set(redis_key, 0, timeout=300)
    except Exception as exc:
        logger.warning("Error releasing concurrency slot on '%s': %s", redis_key, exc)


@contextmanager
def concurrency_slot(slot_key: str, max_slots: int = 3, timeout_seconds: int = 60) -> Generator[bool, None, None]:
    """
    Context manager for acquiring and safely releasing a concurrency slot.
    """
    acquired = acquire_concurrency_slot(slot_key=slot_key, max_slots=max_slots, timeout_seconds=timeout_seconds)
    try:
        yield acquired
    finally:
        if acquired:
            release_concurrency_slot(slot_key=slot_key)


# ---------------------------------------------------------------------------
# 3. Redis Rate Limiter
# ---------------------------------------------------------------------------


def check_rate_limit(key: str, limit: int, window_seconds: int = 3600) -> bool:
    """
    Checks if a rate-limited action is allowed under `limit` within `window_seconds`.
    Does NOT increment the counter.

    Args:
        key: Rate limit bucket key (e.g. 'download:student_12:summary_45').
        limit: Max allowed operations.
        window_seconds: Time window in seconds (default: 3600 = 1 hour).

    Returns:
        True if under limit (action allowed), False if limit reached (throttled).
    """
    rate_key = f"ratelimit:{key}"
    client = _get_raw_redis_client()
    try:
        if client:
            val = client.get(rate_key)
            count = int(val or 0)
            return count < limit
        current = cache.get(rate_key, 0)
        return int(current or 0) < limit
    except Exception as exc:
        logger.warning("Rate limit check error on '%s': %s. Permitting action.", rate_key, exc)
        return True


def increment_successful_counter(key: str, window_seconds: int = 3600) -> int:
    """
    Increments the successful counter for a given rate-limited action upon 200 OK.
    Sets the window expiration if this is the first occurrence.

    Args:
        key: Rate limit bucket key.
        window_seconds: Window duration in seconds.

    Returns:
        The new counter value.
    """
    rate_key = f"ratelimit:{key}"
    client = _get_raw_redis_client()

    try:
        if client:
            pipe = client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, window_seconds)
            results = pipe.execute()
            return int(results[0])
        else:
            try:
                val = cache.incr(rate_key)
            except Exception:
                cache.set(rate_key, 1, timeout=window_seconds)
                val = 1
            return int(val)
    except Exception as exc:
        logger.warning("Error incrementing successful counter on '%s': %s", rate_key, exc)
        return 1


def get_rate_limit_status(key: str, limit: int) -> dict[str, int]:
    """
    Returns the current usage and remaining allowance for a rate limit key.
    """
    rate_key = f"ratelimit:{key}"
    client = _get_raw_redis_client()
    try:
        if client:
            val = client.get(rate_key)
            current = int(val or 0)
        else:
            current = int(cache.get(rate_key, 0) or 0)
    except Exception:
        current = 0
    return {
        "current": current,
        "limit": limit,
        "remaining": max(0, limit - current),
    }


def reset_rate_limit(key: str) -> None:
    """
    Resets the rate limit counter for a given key (used for testing or admin overrides).
    """
    rate_key = f"ratelimit:{key}"
    client = _get_raw_redis_client()
    try:
        if client:
            client.delete(rate_key)
        cache.delete(rate_key)
    except Exception as exc:
        logger.warning("Error deleting rate limit key '%s': %s", rate_key, exc)
