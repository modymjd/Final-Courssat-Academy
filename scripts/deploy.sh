#!/bin/bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deployer/courssat}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
LOG_DIR="${APP_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy.log"

mkdir -p "$LOG_DIR"
cd "$APP_DIR"

log() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $1" | tee -a "$LOG_FILE"
}

compose() {
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

log "=========================================="
log "Starting Courssat Academy production deployment"
log "=========================================="

if [ "${SKIP_GIT_PULL:-0}" = "1" ]; then
  log "Skipping Git update because SKIP_GIT_PULL=1."
elif git rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
     git remote get-url origin >/dev/null 2>&1; then
  log "Fetching latest code..."
  git fetch origin main
  git checkout main
  git reset --hard origin/main
else
  log "No Git origin found; deploying the files already present in APP_DIR."
fi

log "Validating Docker Compose configuration..."
ENV_FILE="$ENV_FILE" bash scripts/production_preflight.sh
compose config -q

log "Building and restarting containers..."
compose up -d --build --remove-orphans

# Nginx renders its config from /etc/nginx/templates only when the container
# starts, and `compose up` does not recreate it when only a mounted template
# changed. Validate the new config with a throwaway container first (aborts the
# deploy, leaving the running Nginx untouched, if it is invalid), then recreate.
log "Validating rendered Nginx config before recreating Nginx..."
compose run --rm --no-deps nginx nginx -t

log "Recreating Nginx so template changes take effect..."
compose up -d --no-deps --force-recreate nginx

log "Waiting for backend health..."
ATTEMPTS=0
MAX_ATTEMPTS=24

while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
    HEALTH_STATUS="$(docker inspect --format='{{.State.Health.Status}}' courssat-backend 2>/dev/null || true)"

    if [ "$HEALTH_STATUS" = "healthy" ]; then
        log "Backend is healthy."
        break
    fi

    if [ "$HEALTH_STATUS" = "unhealthy" ]; then
        log "ERROR: Backend became unhealthy."
        exit 1
    fi

    log "Waiting for backend health... ($ATTEMPTS/$MAX_ATTEMPTS)"
    sleep 5
    ATTEMPTS=$((ATTEMPTS + 1))
done

if [ "$ATTEMPTS" -eq "$MAX_ATTEMPTS" ]; then
    log "ERROR: Timeout waiting for backend health."
    exit 1
fi

log "Running Django migrations..."
docker exec courssat-backend python manage.py migrate --noinput

log "Collecting static files..."
docker exec courssat-backend python manage.py collectstatic --noinput

log "Waiting for frontend container health..."
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-courssat-frontend}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
POLL_INTERVAL=5

deadline=$((SECONDS + HEALTH_TIMEOUT))

while (( SECONDS < deadline )); do
    status="$(docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$FRONTEND_CONTAINER" 2>/dev/null || true)"

    log "Frontend status: ${status:-not-found}"

    case "$status" in
        healthy)
            log "Frontend is healthy."
            break
            ;;
        unhealthy)
            log "ERROR: Frontend became unhealthy."
            docker logs --tail 200 "$FRONTEND_CONTAINER" || true
            docker inspect "$FRONTEND_CONTAINER" \
                --format '{{json .State.Health}}' || true
            exit 1
            ;;
        exited|dead)
            log "ERROR: Frontend container stopped unexpectedly."
            docker logs --tail 200 "$FRONTEND_CONTAINER" || true
            exit 1
            ;;
        starting|created|running|"")
            sleep "$POLL_INTERVAL"
            ;;
        *)
            log "Unexpected frontend status: $status"
            sleep "$POLL_INTERVAL"
            ;;
    esac
done

if (( SECONDS >= deadline )); then
    log "ERROR: Frontend did not become healthy within ${HEALTH_TIMEOUT}s."
    docker logs --tail 200 "$FRONTEND_CONTAINER" || true
    docker inspect "$FRONTEND_CONTAINER" \
        --format '{{json .State.Health}}' || true
    exit 1
fi

log "Validating Nginx configuration..."
docker exec courssat-nginx nginx -t

log "Running production smoke tests..."

API_HEALTH="$(curl -fsS https://api.courssat.online/api/v1/health/readiness/)"
log "API health: $API_HEALTH"

curl -fsSI https://courssat.online >/dev/null
curl -fsSI https://api.courssat.online/api/v1/health/readiness/ >/dev/null

log "Validating that /media/ is served by Nginx on both domains..."
docker exec courssat-backend sh -c 'mkdir -p /app/media/_healthcheck && echo ok > /app/media/_healthcheck/ping.txt'
curl -fsS https://api.courssat.online/media/_healthcheck/ping.txt >/dev/null
curl -fsS https://courssat.online/media/_healthcheck/ping.txt >/dev/null

log "Validating production CORS policy..."
CORS_HEADERS="$(curl -fsS -i -X OPTIONS \
  -H 'Origin: https://courssat.online' \
  -H 'Access-Control-Request-Method: GET' \
  https://api.courssat.online/api/v1/health/readiness/ || true)"
if ! grep -qi '^access-control-allow-origin: https://courssat.online' <<< "$CORS_HEADERS"; then
    log "ERROR: Production CORS validation failed."
    exit 1
fi

log "Validating HTTPS security headers..."
SECURITY_HEADERS="$(curl -fsSI https://courssat.online)"
grep -qi '^strict-transport-security:' <<< "$SECURITY_HEADERS"
grep -qi '^x-content-type-options: nosniff' <<< "$SECURITY_HEADERS"

grep -qi '^referrer-policy:' <<< "$SECURITY_HEADERS"

log "Production deployment completed successfully."
