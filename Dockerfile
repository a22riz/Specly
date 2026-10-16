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
# /app/data must exist with the right owner so the named volume inherits it.
RUN groupadd -r specly && useradd -r -g specly specly \
 && mkdir -p /app/data && chown -R specly:specly /app/data
COPY --from=build --chown=specly:specly /app/.next/standalone ./
COPY --from=build --chown=specly:specly /app/.next/static ./.next/static
COPY --from=build --chown=specly:specly /app/public ./public
USER specly
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
