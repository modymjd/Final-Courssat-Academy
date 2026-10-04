#!/usr/bin/env bash
set -Eeuo pipefail

# Encrypted PostgreSQL backup for both the Docker production stack and a
# directly reachable PostgreSQL server.

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/home/deployer/backups/courssat}"
LOG_FILE="${LOG_FILE:-${APP_DIR}/logs/backup.log}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-courssat-postgres}"
DB_NAME="${DB_NAME:-courssat}"
DB_USER="${DB_USER:-courssat}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DATE="$(date +%Y-%m-%d_%H-%M-%S)"
FILENAME="courssat_db_${DATE}.dump"
ENCRYPTED_FILE="${BACKUP_DIR}/${FILENAME}.gpg"
TEMP_DUMP="$(mktemp --suffix=.dump)"

cleanup() {
  rm -f "$TEMP_DUMP"
  unset PGPASSWORD
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')] $*" | tee -a "$LOG_FILE"
}

require_value() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    log "ERROR: ${name} is required."
    exit 1
  fi
}

require_value DB_PASSWORD
require_value GPG_PASSPHRASE
command -v gpg >/dev/null || { log "ERROR: gpg is not installed."; exit 1; }

log "Starting PostgreSQL backup for database ${DB_NAME}."
if command -v docker >/dev/null && docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
  log "Using PostgreSQL tools inside ${POSTGRES_CONTAINER}."
  docker exec \
    -e PGPASSWORD="$DB_PASSWORD" \
    "$POSTGRES_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$TEMP_DUMP"
else
  command -v pg_dump >/dev/null || {
    log "ERROR: neither ${POSTGRES_CONTAINER} nor a local pg_dump command is available."
    exit 1
  }
  export PGPASSWORD="$DB_PASSWORD"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc > "$TEMP_DUMP"
fi

if [ ! -s "$TEMP_DUMP" ]; then
  log "ERROR: generated backup is empty."
  exit 1
fi

log "Encrypting backup with AES-256."
printf '%s' "$GPG_PASSPHRASE" |
  gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --symmetric --cipher-algo AES256 \
    --output "$ENCRYPTED_FILE" "$TEMP_DUMP"

sha256sum "$ENCRYPTED_FILE" > "${ENCRYPTED_FILE}.sha256"
chmod 600 "$ENCRYPTED_FILE" "${ENCRYPTED_FILE}.sha256"

if [ "${1:-}" = "--verify" ]; then
  VERIFY_FILE="$(mktemp --suffix=.dump)"
  trap 'rm -f "$TEMP_DUMP" "$VERIFY_FILE"; unset PGPASSWORD' EXIT
  printf '%s' "$GPG_PASSPHRASE" |
    gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
      --decrypt --output "$VERIFY_FILE" "$ENCRYPTED_FILE"
  cmp -s "$TEMP_DUMP" "$VERIFY_FILE" || {
    log "ERROR: encrypted backup verification failed."
    exit 1
  }
  rm -f "$VERIFY_FILE"
  log "Encrypted backup verification passed."
fi

find "$BACKUP_DIR" -type f \( -name "courssat_db_*.dump.gpg" -o -name "courssat_db_*.dump.gpg.sha256" \) \
  -mtime "+${RETENTION_DAYS}" -delete

log "Backup completed: ${ENCRYPTED_FILE}"