from django.core.cache import cache
from django.test import TestCase

from apps.common.services.redis_service import (
    acquire_concurrency_slot,
    acquire_lock,
    check_rate_limit,
    concurrency_slot,
    increment_successful_counter,
    redis_lock,
    release_concurrency_slot,
    release_lock,
    reset_rate_limit,
)


class RedisServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_distributed_lock_acquire_and_release(self):
        key = "test_resource_lock"
        token1 = acquire_lock(key, expire=30)
        self.assertIsNotNone(token1)

        # Second attempt should fail to acquire the same lock
        token2 = acquire_lock(key, expire=30, timeout=0.0)
        self.assertIsNone(token2)

        # Release with wrong token should fail
        released_wrong = release_lock(key, "wrong_token")
        self.assertFalse(released_wrong)

        # Release with correct token succeeds
        released = release_lock(key, token1)
        self.assertTrue(released)

        # Now acquire succeeds again
        token3 = acquire_lock(key, expire=30)
        self.assertIsNotNone(token3)
        release_lock(key, token3)

    def test_redis_lock_context_manager(self):
        key = "cm_resource_lock"
        with redis_lock(key, expire=10) as token:
            self.assertIsNotNone(token)
            # Inside context, cannot re-acquire
            token_inner = acquire_lock(key, expire=10, timeout=0.0)
            self.assertIsNone(token_inner)

        # Outside context, lock is released
        token_after = acquire_lock(key, expire=10)
        self.assertIsNotNone(token_after)
        release_lock(key, token_after)

    def test_concurrency_slot_limiter(self):
        slot_key = "pdf_watermarking"
        max_slots = 3

        # Acquire 3 slots
        slot1 = acquire_concurrency_slot(slot_key, max_slots=max_slots)
        slot2 = acquire_concurrency_slot(slot_key, max_slots=max_slots)
        slot3 = acquire_concurrency_slot(slot_key, max_slots=max_slots)
        self.assertTrue(slot1)
        self.assertTrue(slot2)
        self.assertTrue(slot3)

        # 4th slot must fail
        slot4 = acquire_concurrency_slot(slot_key, max_slots=max_slots)
        self.assertFalse(slot4)

        # Release 1 slot
        release_concurrency_slot(slot_key)

        # Now acquisition succeeds
        slot5 = acquire_concurrency_slot(slot_key, max_slots=max_slots)
        self.assertTrue(slot5)

        # Clean up
        release_concurrency_slot(slot_key)
        release_concurrency_slot(slot_key)
        release_concurrency_slot(slot_key)

    def test_rate_limiter(self):
        key = "student_dl_101"
        limit = 5
        reset_rate_limit(key)

        # Initially allowed
        self.assertTrue(check_rate_limit(key, limit=limit))

        # Simulate 5 successful downloads
        for _ in range(5):
            increment_successful_counter(key, window_seconds=3600)

        # Now at limit: check_rate_limit returns False
        self.assertFalse(check_rate_limit(key, limit=limit))

        # Reset
        reset_rate_limit(key)
        self.assertTrue(check_rate_limit(key, limit=limit))
