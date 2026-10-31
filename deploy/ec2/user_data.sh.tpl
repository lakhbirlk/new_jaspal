#!/bin/bash
# First-boot script: install Docker, build the image natively for arm64, and
# run MySQL, the application, and Caddy for HTTPS.
# Progress: /var/log/user-data.log
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
# MySQL. The named volume keeps data across container recreation; the data
# lives on the instance's root disk, so terminating the instance loses it.
# ---------------------------------------------------------------------------
docker network create appnet 2>/dev/null || true
docker rm -f app-db 2>/dev/null || true

docker run -d --name app-db --network appnet --restart unless-stopped \
  -e MYSQL_DATABASE=${db_name} \
  -e MYSQL_USER=${db_user} \
  -e MYSQL_PASSWORD=${db_password} \
  -e MYSQL_ROOT_PASSWORD=${db_password} \
  -v app-mysqldata:/var/lib/mysql \
  ${mysql_image} \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_0900_ai_ci \
  --default-time-zone=+00:00

until docker exec app-db mysqladmin ping -h 127.0.0.1 -u ${db_user} -p${db_password} --silent >/dev/null 2>&1; do
  sleep 3
done

# ---------------------------------------------------------------------------
# Application (API + SPA on one port)
# ---------------------------------------------------------------------------
docker rm -f app 2>/dev/null || true

docker run -d --name app --network appnet --restart unless-stopped \
  -p ${app_port}:${app_port} \
  -e PORT=${app_port} \
  -e DB_URL="jdbc:mysql://app-db:3306/${db_name}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false" \
  -e DB_USER=${db_user} \
  -e DB_PASSWORD=${db_password} \
  -e JWT_SECRET=${jwt_secret} \
  -e APP_CRYPTO_KEY=${crypto_key} \
  -e ADMIN_EMAIL=${admin_email} \
  -e ADMIN_NAME="${admin_name}" \
  -e ADMIN_PASSWORD=${admin_pass} \
  -e SEED_DEMO=${seed_demo} \
  -e FRONTEND_URL=${app_url} \
  -e CORS_ORIGINS="${app_url},${direct_url}" \
  -e JAVA_OPTS="-XX:MaxRAMPercentage=55" \
  business-directory:local

# ---------------------------------------------------------------------------
# Caddy: public HTTPS termination with a Let's Encrypt certificate.
# Caddy obtains the certificate on first request using the HTTP-01 challenge,
# which needs port 80 reachable from the internet and the hostname resolving
# to this Elastic IP.
# ---------------------------------------------------------------------------
cat > /opt/app/Caddyfile <<'CADDY'
{
  email ${tls_email}
}

${https_host} {
  encode gzip
  reverse_proxy app:8080
}
CADDY

docker rm -f caddy 2>/dev/null || true

docker run -d --name caddy --network appnet --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 443:443/udp \
  -v /opt/app/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2-alpine
