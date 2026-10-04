#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/restore_database.sh <backup.dump.gpg>
      Restores into a temporary database, verifies it, then removes it.

  scripts/restore_database.sh <backup.dump.gpg> --target-db NAME
      Restores into a named non-production database.

  scripts/restore_database.sh <backup.dump.gpg> --target-db NAME \
      --production --confirm-production
      Destructive production restore. Both flags are mandatory.
EOF
}

[ "$#" -ge 1 ] || { usage; exit 1; }

BACKUP_FILE="$1"
shift
TARGET_DB="test_courssat_restore_$(date +%s)"
DROP_AFTER_VERIFY=true
PRODUCTION=false
CONFIRMED=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-db)
      [ "$#" -ge 2 ] || { echo "ERROR: --target-db requires a value."; exit 1; }
      TARGET_DB="$2"
      DROP_AFTER_VERIFY=false
      shift 2
      ;;
    --production)
      PRODUCTION=true
      shift
      ;;
    --confirm-production)
      CONFIRMED=true
      shift
      ;;
    *)
      echo "ERROR: unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

[ -f "$BACKUP_FILE" ] || { echo "ERROR: backup file does not exist: $BACKUP_FILE"; exit 1; }
[ -n "${DB_PASSWORD:-}" ] || { echo "ERROR: DB_PASSWORD is required."; exit 1; }
[ -n "${GPG_PASSPHRASE:-}" ] || { echo "ERROR: GPG_PASSPHRASE is required."; exit 1; }

if [ "$PRODUCTION" = true ] && [ "$CONFIRMED" != true ]; then
  echo "ERROR: production restore requires --confirm-production."
  exit 1
fi
if [ "$CONFIRMED" = true ] && [ "$PRODUCTION" != true ]; then
  echo "ERROR: --confirm-production is only valid with --production."
  exit 1
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-courssat-postgres}"
DB_USER="${DB_USER:-courssat}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
TEMP_DUMP="$(mktemp --suffix=.dump)"
CONTAINER_DUMP="/tmp/courssat-restore-$$.dump"
USE_DOCKER=false

if ! [[ "$TARGET_DB" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "ERROR: database name may contain only letters, numbers, and underscores."
  exit 1
fi

cleanup() {
  rm -f "$TEMP_DUMP"
  if [ "$USE_DOCKER" = true ]; then
    docker exec "$POSTGRES_CONTAINER" rm -f "$CONTAINER_DUMP" >/dev/null 2>&1 || true
  fi
  unset PGPASSWORD
}
trap cleanup EXIT

printf '%s' "$GPG_PASSPHRASE" |
  gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --decrypt --output "$TEMP_DUMP" "$BACKUP_FILE"
[ -s "$TEMP_DUMP" ] || { echo "ERROR: decrypted backup is empty."; exit 1; }

if command -v docker >/dev/null && docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
  USE_DOCKER=true
  docker cp "$TEMP_DUMP" "${POSTGRES_CONTAINER}:${CONTAINER_DUMP}" >/dev/null
  psql_cmd() {
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"
  }
  pg_restore_cmd() {
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
      pg_restore -U "$DB_USER" "$@"
  }
  RESTORE_SOURCE="$CONTAINER_DUMP"
else
  command -v psql >/dev/null && command -v pg_restore >/dev/null || {
    echo "ERROR: PostgreSQL tools are not available."
    exit 1
  }
  export PGPASSWORD="$DB_PASSWORD"
  psql_cmd() {
    psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
  }
  pg_restore_cmd() {
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
  }
  RESTORE_SOURCE="$TEMP_DUMP"
fi

START_TIME="$(date +%s)"

if [ "$PRODUCTION" = true ]; then
  echo "WARNING: terminating connections and replacing production database ${TARGET_DB}."
  psql_cmd -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TARGET_DB}' AND pid <> pg_backend_pid();"
  psql_cmd -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
  psql_cmd -d postgres -c "CREATE DATABASE \"${TARGET_DB}\" OWNER \"${DB_USER}\";"
else
  psql_cmd -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TARGET_DB}' AND pid <> pg_backend_pid();"
  psql_cmd -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
  psql_cmd -d postgres -c "CREATE DATABASE \"${TARGET_DB}\" OWNER \"${DB_USER}\";"
fi

echo "Restoring ${BACKUP_FILE} into ${TARGET_DB}..."
pg_restore_cmd --exit-on-error --single-transaction --no-owner --no-privileges \
  -d "$TARGET_DB" "$RESTORE_SOURCE"

TABLE_COUNT="$(psql_cmd -d "$TARGET_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')"
MIGRATION_COUNT="$(psql_cmd -d "$TARGET_DB" -tAc "SELECT count(*) FROM django_migrations;" | tr -d '[:space:]')"

if [ "${TABLE_COUNT:-0}" -lt 10 ] || [ "${MIGRATION_COUNT:-0}" -lt 1 ]; then
  echo "ERROR: restore verification failed (tables=${TABLE_COUNT:-0}, migrations=${MIGRATION_COUNT:-0})."
  exit 1
fi

echo "Restore verified: ${TABLE_COUNT} public tables, ${MIGRATION_COUNT} migrations."
echo "Restore time: $(( $(date +%s) - START_TIME )) seconds."

if [ "$DROP_AFTER_VERIFY" = true ]; then
  psql_cmd -d postgres -c "DROP DATABASE \"${TARGET_DB}\";"
  echo "Temporary verification database removed."
else
  echo "Restored database kept at: ${TARGET_DB}"
fi