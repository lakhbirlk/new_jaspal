#!/bin/bash
# First-boot script: install Docker, build the image natively for arm64, and
# run PostgreSQL plus the application container. Progress: /var/log/user-data.log
set -euxo pipefail

exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# ---------------------------------------------------------------------------
# Swap. The Maven + Expo build does not fit in 2 GiB of RAM on its own; the
# build is slow on this box but it does complete.
# ---------------------------------------------------------------------------
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

dnf install -y docker git
systemctl enable --now docker

# ---------------------------------------------------------------------------
# Source and image build
# ---------------------------------------------------------------------------
mkdir -p /opt/app
if [ ! -d /opt/app/repo/.git ]; then
  git clone --depth 1 --branch ${git_branch} ${git_repo_url} /opt/app/repo
fi

cd /opt/app/repo
docker build -t business-directory:local .

# ---------------------------------------------------------------------------
# PostgreSQL. The named volume keeps data across container recreation; the
# data lives on the instance's root disk, so terminating the instance loses it.
# ---------------------------------------------------------------------------
docker network create appnet 2>/dev/null || true
docker rm -f app-db 2>/dev/null || true

docker run -d --name app-db --network appnet --restart unless-stopped \
  -e POSTGRES_DB=${db_name} \
  -e POSTGRES_USER=${db_user} \
  -e POSTGRES_PASSWORD=${db_password} \
  -v app-pgdata:/var/lib/postgresql/data \
  ${postgres_image}

until docker exec app-db pg_isready -U ${db_user} >/dev/null 2>&1; do
  sleep 3
done

# ---------------------------------------------------------------------------
# Application (API + SPA on one port)
# ---------------------------------------------------------------------------
docker rm -f app 2>/dev/null || true

docker run -d --name app --network appnet --restart unless-stopped \
  -p ${app_port}:${app_port} \
  -e PORT=${app_port} \
  -e DB_URL=jdbc:postgresql://app-db:5432/${db_name} \
  -e DB_USER=${db_user} \
  -e DB_PASSWORD=${db_password} \
  -e JWT_SECRET=${jwt_secret} \
  -e APP_CRYPTO_KEY=${crypto_key} \
  -e ADMIN_EMAIL=${admin_email} \
  -e ADMIN_NAME="${admin_name}" \
  -e ADMIN_PASSWORD=${admin_pass} \
  -e SEED_DEMO=${seed_demo} \
  -e FRONTEND_URL=${app_url} \
  -e CORS_ORIGINS=${app_url} \
  -e JAVA_OPTS="-XX:MaxRAMPercentage=55" \
  business-directory:local
