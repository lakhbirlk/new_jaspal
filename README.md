# Multi-Role Business Directory Platform

A business directory with four roles (guest, researcher, business owner, administrator), plus a
read-only auditor portal. The API is Java 21 / Spring Boot 3 with PostgreSQL; the client is React
Native / TypeScript (Expo) targeting Android, iOS and the web.

## Single-image deployment

`Dockerfile` builds the Expo web client and the Spring Boot API into **one image**. The exported
web build is copied into the API's static resources, so a single JVM serves:

| Path | Served by |
| --- | --- |
| `/`, `/assets/**`, `/_expo/**` | exported React Native Web bundle |
| `/login`, `/register`, `/forgot-password`, `/accept-invite`, `/reset-password`, `/verify-email` | `SpaController` → `index.html` (public email deep links) |
| `/api/v1/**` | Spring Boot REST API |

The web bundle is built with `EXPO_PUBLIC_API_URL=/`, which `src/api/client.ts` turns into a
relative base, so browser requests stay on the same origin and need no CORS configuration.

### Build

```bash
docker build -t business-directory:latest .
```

### Run with PostgreSQL

```bash
cp .env.example .env      # change JWT_SECRET, APP_CRYPTO_KEY and ADMIN_PASSWORD
docker compose up --build -d
```

Then open <http://localhost:8080>. The database is a named volume (`pgdata`) and migrations run
automatically on startup. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`; administrators do not
use MFA. Auditors still enrol TOTP.

### Run the image against an existing PostgreSQL

```bash
docker run -d --name business-directory -p 8080:8080 \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/directory \
  -e DB_USER=directory -e DB_PASSWORD=directory \
  -e JWT_SECRET='...at least 32 bytes...' \
  -e APP_CRYPTO_KEY='...base64 32-byte key...' \
  -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='...' \
  -e FRONTEND_URL=https://directory.example.com \
  business-directory:latest
```

### Configuration

All settings are environment variables; the full list lives in `.env.example` and
`backend/src/main/resources/application.yml`.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port inside the container (default `8080`) |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | HMAC key for access tokens (≥ 32 bytes) |
| `APP_CRYPTO_KEY` | Base64 32-byte AES key for encrypted fields |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Bootstrap administrator |
| `FRONTEND_URL` | Public URL used in email links |
| `CORS_ORIGINS` | Allowed browser origins (not needed when same-origin) |
| `SMTP_*`, `MAIL_FROM` | Outbound mail; if `SMTP_HOST` is empty, mail is skipped |
| `PAYMENT_WEBHOOK_SECRET` | Signing secret for the payment webhook |

`ADMIN_EMAIL` / `ADMIN_PASSWORD` are only used to create the first administrator when the
database has no admin account. Changing them later does not rotate the password; sign in and
change it from the account screen instead.

The container exposes `GET /` as its health check. The `business-directory` user is unprivileged.

## Deploying to AWS ECS

A Terraform stack in [`deploy/aws`](deploy/aws/README.md) runs the image on ECS Fargate Spot with
RDS PostgreSQL, an Application Load Balancer and SSM-backed secrets. Its default 2 vCPU / 4 GB
task, public subnets without a NAT gateway, single-AZ `db.t4g.micro` and 7-day log retention keep
the bill at roughly $55–65/month in `us-east-1`; dropping the task to 2 GB brings it to about
$40–46/month. See the [deployment README](deploy/aws/README.md) for build/push, HTTPS and teardown
steps.

## Local development

```bash
# API with an embedded PostgreSQL (dev profile also seeds demo accounts)
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=embedded,dev

# Web client with hot reload on http://localhost:8081
cd frontend
npm install
npx expo start --web --port 8081
```

The web dev client talks to `http://localhost:8080`. To point it elsewhere, export
`EXPO_PUBLIC_API_URL` before starting Expo. Mobile builds use `10.0.2.2` on the Android emulator
and `localhost` on iOS.

## Tests

```bash
cd backend && mvn test
cd frontend && npx tsc --noEmit && npx eslint src
```
