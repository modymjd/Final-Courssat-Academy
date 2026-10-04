#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.prod.yml}"

fail() {
  echo "PREFLIGHT ERROR: $*" >&2
  exit 1
}

[ -f "$ENV_FILE" ] || fail "missing ${ENV_FILE}; copy .env.production.example and fill it first."
[ -f "$COMPOSE_FILE" ] || fail "missing ${COMPOSE_FILE}."
command -v docker >/dev/null || fail "Docker is not installed."
docker compose version >/dev/null || fail "Docker Compose v2 is not available."

set -a
# The production env file is an operator-owned configuration file.
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  SECRET_KEY
  DB_NAME
  DB_USER
  DB_PASSWORD
  REDIS_PASSWORD
  REDIS_URL
  CELERY_BROKER_URL
  CELERY_RESULT_BACKEND
  NGINX_SECURE_LINK_SECRET
  GRAFANA_PASSWORD
  NATIONAL_ID_FERNET_KEYS
  NATIONAL_ID_PEPPER
  ALLOWED_HOSTS
  CORS_ALLOWED_ORIGINS
  CSRF_TRUSTED_ORIGINS
)

for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || fail "${name} is empty."
done

case "$SECRET_KEY" in
  change*|*change_me*|*local-only*) fail "SECRET_KEY still contains a placeholder." ;;
esac
case "$DB_PASSWORD" in
  postgres|change*|*change_me*) fail "DB_PASSWORD is insecure or still a placeholder." ;;
esac
case "$NGINX_SECURE_LINK_SECRET" in
  secret|change*|*change_me*|courssat_nginx_local_hls_secret_key_2026)
    fail "NGINX_SECURE_LINK_SECRET is insecure or still a placeholder."
    ;;
esac
case "$GRAFANA_PASSWORD" in
  admin|changeme|change*|*change_me*) fail "GRAFANA_PASSWORD is insecure or still a placeholder." ;;
esac

[ "${#SECRET_KEY}" -ge 50 ] || fail "SECRET_KEY must be at least 50 characters."
[ "${#DB_PASSWORD}" -ge 16 ] || fail "DB_PASSWORD must be at least 16 characters."
[ "${#REDIS_PASSWORD}" -ge 16 ] || fail "REDIS_PASSWORD must be at least 16 characters."
[ "${#NGINX_SECURE_LINK_SECRET}" -ge 32 ] || fail "NGINX_SECURE_LINK_SECRET must be at least 32 characters."
[ "${#GRAFANA_PASSWORD}" -ge 16 ] || fail "GRAFANA_PASSWORD must be at least 16 characters."
[ "${#NATIONAL_ID_PEPPER}" -ge 32 ] || fail "NATIONAL_ID_PEPPER must be at least 32 characters."
[ "${DEBUG:-False}" = "False" ] || fail "DEBUG must be exactly False."

case "$NATIONAL_ID_FERNET_KEYS" in
  change*|*change_me*) fail "NATIONAL_ID_FERNET_KEYS still contains a placeholder." ;;
esac
case "$NATIONAL_ID_PEPPER" in
  change*|*change_me*) fail "NATIONAL_ID_PEPPER still contains a placeholder." ;;
esac

case "${VIDEO_STORAGE_ADAPTER:-local}" in
  local)
    [ "${REQUIRE_VIDEO_CDN:-False}" = "False" ] ||
      fail "REQUIRE_VIDEO_CDN=True cannot be used with VIDEO_STORAGE_ADAPTER=local."
    ;;
  bunny)
    [ -n "${BUNNY_STREAM_LIBRARY_ID:-}" ] || fail "BUNNY_STREAM_LIBRARY_ID is required for Bunny."
    [ -n "${BUNNY_STREAM_API_KEY:-}" ] || fail "BUNNY_STREAM_API_KEY is required for Bunny."
    [ -n "${BUNNY_STREAM_TOKEN_KEY:-}" ] || fail "BUNNY_STREAM_TOKEN_KEY is required for Bunny."
    ;;
  *)
    fail "VIDEO_STORAGE_ADAPTER must be local or bunny."
    ;;
esac

case "$REDIS_PASSWORD" in
  redis|change*|*change_me*) fail "REDIS_PASSWORD is insecure or still a placeholder." ;;
esac

for redis_url in "$REDIS_URL" "$CELERY_BROKER_URL" "$CELERY_RESULT_BACKEND"; do
  [[ "$redis_url" == redis://:*@redis:* ]] || fail "Redis URLs must include REDIS_PASSWORD and target the redis service."
  [[ "$redis_url" == *":${REDIS_PASSWORD}@"* ]] || fail "Redis URL password does not match REDIS_PASSWORD."
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config -q

echo "Production preflight passed."