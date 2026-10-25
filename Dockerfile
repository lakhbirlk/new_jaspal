# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1. Build the React Native Web client (Expo static export)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS web

WORKDIR /build/frontend

ENV CI=1 \
    EXPO_NO_TELEMETRY=1

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# "/" keeps API calls on the same origin as the page. src/api/client.ts strips the
# trailing slash, so requests become /api/v1/... and are served by this same jar.
ENV EXPO_PUBLIC_API_URL=/
RUN npx expo export --platform web --output-dir dist

# ---------------------------------------------------------------------------
# 2. Build the Spring Boot API and embed the web client in its static resources
# ---------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS api

WORKDIR /build/backend

COPY backend/pom.xml ./
COPY backend/src ./src
COPY --from=web /build/frontend/dist ./src/main/resources/static

RUN mvn -B -ntp package -DskipTests

# ---------------------------------------------------------------------------
# 3. Runtime: one JVM serving both the SPA and the API on port 8080
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=api /build/backend/target/business-directory-1.0.0.jar /app/app.jar

# Defaults for the single-image (same-origin) deployment; override for a public host.
ENV PORT=8080 \
    FRONTEND_URL=http://localhost:8080 \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

USER app

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
