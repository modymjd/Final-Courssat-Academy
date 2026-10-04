#!/bin/bash
set -e

# Use the same DB_* variables as Django settings. POSTGRES_* remains supported
# for backwards compatibility with older deployments.
DATABASE_HOST="${DB_HOST:-${POSTGRES_HOST:-postgres}}"
DATABASE_PORT="${DB_PORT:-${POSTGRES_PORT:-5432}}"
DATABASE_USER="${DB_USER:-${POSTGRES_USER:-postgres}}"

# Wait for PostgreSQL to be ready
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" >/dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

echo "PostgreSQL is ready."

# Create required media directories
mkdir -p /app/media/scratch /app/media/hls /app/media/attachments /app/media/thumbnails

# Dispatch based on SERVICE_TYPE
SERVICE_TYPE=${SERVICE_TYPE:-default}

case "$SERVICE_TYPE" in
  "api")
    # Migrations and static collection must run exactly once. Celery containers
    # wait for the healthy API service and must not race these operations.
    python manage.py migrate --noinput
    python manage.py collectstatic --noinput
    exec gunicorn config.asgi:application -c gunicorn.conf.py
    ;;
  "celery-default")
    exec celery -A config worker -Q default -c 3 --max-tasks-per-child=500 -l info
    ;;
  "celery-video")
    exec nice -n 10 celery -A config worker -Q video_queue -c 1 --max-tasks-per-child=50 -l info
    ;;
  "celery-beat")
    exec celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    ;;
  *)
    exec gunicorn config.asgi:application -c gunicorn.conf.py
    ;;
esac
