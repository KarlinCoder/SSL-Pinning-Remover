# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openjdk-17-jre-headless \
        zip \
        unzip \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.12.1

WORKDIR /app

# Install dependencies first for better Docker layer caching.
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm --filter @apk-https-lab/web build \
    && pnpm --filter @apk-https-lab/api build

# Create the runtime user and the apk-mitm tool cache.
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /home/app/.cache/apk-mitm /opt/tools /data

# Pre-download the patching tools and verify their SHA-256 checksums.
# apk-mitm 1.3.0 expects these exact cache filenames:
#   ~/.cache/apk-mitm/apktool-v2.9.3.jar
#   ~/.cache/apk-mitm/uber-apk-signer-v1.3.0.jar
RUN curl -fsSL --retry 3 -o /opt/tools/apktool_3.0.3.jar \
        https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar \
    && echo "dbf930b076c6b9be08d57c449cacefc3bdd6b71ebd59b3066fc0e1f5b14f9423  /opt/tools/apktool_3.0.3.jar" \
        | sha256sum -c - \
    && curl -fsSL --retry 3 -o /opt/tools/apktool_2.9.3.jar \
        https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar \
    && echo "7956eb04194300ce0d0a84ad18771eebc94b89fb8d1ddcce8ea4c056818646f4  /opt/tools/apktool_2.9.3.jar" \
        | sha256sum -c - \
    && curl -fsSL --retry 3 -o /opt/tools/uber-apk-signer-1.3.0.jar \
        https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar \
    && echo "e1299fd6fcf4da527dd53735b56127e8ea922a321128123b9c32d619bba1d835  /opt/tools/uber-apk-signer-1.3.0.jar" \
        | sha256sum -c - \
    && cp /opt/tools/apktool_2.9.3.jar /home/app/.cache/apk-mitm/apktool-v2.9.3.jar \
    && cp /opt/tools/uber-apk-signer-1.3.0.jar /home/app/.cache/apk-mitm/uber-apk-signer-v1.3.0.jar \
    && chown -R app:app /data /home/app/.cache

ENV NODE_ENV=production \
    HOME=/home/app \
    XDG_CACHE_HOME=/home/app/.cache \
    LANG=C.UTF-8 \
    PORT=3000 \
    DATA_DIR=/data \
    APKTOOL_JAR=/opt/tools/apktool_3.0.3.jar \
    APKTOOL_FALLBACK_JAR=/opt/tools/apktool_2.9.3.jar

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
