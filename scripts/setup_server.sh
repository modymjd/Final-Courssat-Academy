#!/usr/bin/env bash
set -Eeuo pipefail

# Ubuntu 24.04 host bootstrap for the Docker production stack.
# Run once as a sudo-capable user. Application services remain inside Docker;
# do not install competing host PostgreSQL/Redis/Nginx services.

APP_USER="${APP_USER:-deployer}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/courssat}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  command -v sudo >/dev/null || { echo "sudo is required."; exit 1; }
  SUDO="sudo"
fi

echo "[1/5] Installing host prerequisites..."
$SUDO apt-get update
$SUDO apt-get install -y ca-certificates curl gnupg git ufw gpg

echo "[2/5] Installing Docker Engine and Compose plugin..."
$SUDO install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
$SUDO chmod a+r /etc/apt/keyrings/docker.gpg
ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" |
  $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
$SUDO apt-get update
$SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
$SUDO systemctl enable --now docker

echo "[3/5] Granting ${APP_USER} Docker access..."
$SUDO usermod -aG docker "$APP_USER"
$SUDO install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"

echo "[4/5] Configuring firewall..."
$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable

echo "[5/5] Applying safe host limits..."
cat <<'EOF' | $SUDO tee /etc/sysctl.d/99-courssat.conf >/dev/null
vm.swappiness=10
fs.file-max=1048576
net.core.somaxconn=4096
EOF
$SUDO sysctl --system >/dev/null

if ! swapon --show | grep -q .; then
  echo "No swap detected; creating a 4 GiB emergency swap file."
  $SUDO fallocate -l 4G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

cat <<EOF

Host bootstrap completed.

Next:
1. Log out and back in so Docker group membership is active.
2. Clone the repository into: ${APP_DIR}
3. Create .env.production from .env.production.example and replace every placeholder.
4. Point DNS for courssat.online, www, and api to this server.
5. Run: bash scripts/init_ssl.sh
6. Run: ENV_FILE=.env.production bash scripts/production_preflight.sh
7. Run: bash scripts/deploy.sh
EOF