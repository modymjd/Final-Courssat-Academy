#!/bin/bash
set -Eeuo pipefail

# ============================================================================
# Initial SSL Setup Script for Courssat Academy
# ============================================================================

DOMAINS="courssat.online www.courssat.online api.courssat.online"
EMAIL="${CERTBOT_EMAIL:-admin@courssat.online}"
CERTBOT_CONF_DIR="${CERTBOT_CONF_DIR:-./infrastructure/nginx/certbot-conf}"
CERTBOT_WEBROOT_DIR="${CERTBOT_WEBROOT_DIR:-./infrastructure/nginx/certbot-www}"
BOOTSTRAP_CONTAINER="courssat-certbot-bootstrap"

# Test mode (default false, pass --staging to enable)
STAGING=""
if [ "${1:-}" = "--staging" ]; then
    STAGING="--staging"
    echo "Running in staging mode..."
fi

mkdir -p "$CERTBOT_CONF_DIR" "$CERTBOT_WEBROOT_DIR"

echo "Requesting Let's Encrypt certificates for: $DOMAINS"

DOMAIN_ARGS=""
for DOMAIN in $DOMAINS; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $DOMAIN"
done

cleanup() {
  docker rm -f "$BOOTSTRAP_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Bootstrap a minimal HTTP server so the webroot challenge works before the
# production Nginx container has a certificate and can start.
cleanup
docker run -d --rm --name "$BOOTSTRAP_CONTAINER" \
  -p 80:80 \
  -v "$(realpath "$CERTBOT_WEBROOT_DIR"):/usr/share/nginx/html:ro" \
  nginx:1.27-alpine >/dev/null

docker run --rm --name courssat-certbot-initial \
  -v "$(realpath "$CERTBOT_CONF_DIR"):/etc/letsencrypt" \
  -v "$(realpath "$CERTBOT_WEBROOT_DIR"):/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  $DOMAIN_ARGS \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring \
  $STAGING

echo "Initial SSL certificates requested."
echo "Please restart Nginx containers to apply the certificates."
