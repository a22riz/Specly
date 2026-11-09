# syntax=docker/dockerfile:1
# Full bookworm (not -slim) for deps/build: ships python3 + make + g++ so
# better-sqlite3 can compile even when prebuilt-binary download is blocked.
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# /app/data must exist with the right owner so a mounted volume inherits it.
# Fixed uid/gid (10001) so Kubernetes securityContext + fsGroup can match it.
RUN groupadd -r -g 10001 specly && useradd -r -u 10001 -g 10001 specly \
 && mkdir -p /app/data && chown -R 10001:10001 /app/data
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build --chown=10001:10001 /app/public ./public
USER 10001:10001
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
