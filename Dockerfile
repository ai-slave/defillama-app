# syntax=docker/dockerfile:1.6

FROM node:24-bookworm-slim AS node-base

WORKDIR /usr/src/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM node-base AS bun-base

ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash

FROM bun-base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

FROM bun-base AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone \
  && rm -rf /var/lib/apt/lists/*

COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ARG COOLIFY_BRANCH
ARG SOURCE_COMMIT
ARG BUILD_DEPLOYMENT_NAME
ARG COOLIFY_CONTAINER_NAME
ARG COOLIFY_RESOURCE_UUID
ARG COOLIFY_FQDN
ARG COOLIFY_URL
ARG BUILD_NOTIFY_USERS

# Promote the commit SHA into the build environment so next.config's
# generateBuildId pins BUILD_ID to the commit when the platform provides a SHA.
# If these args are blank, the build command falls back to the minimal .git
# metadata allowed through .dockerignore.
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

RUN --mount=type=secret,id=BUILD_STATUS_WEBHOOK \
  --mount=type=secret,id=LOGGER_API_URL \
  --mount=type=secret,id=LOGGER_API_KEY \
  if [ -f /run/secrets/BUILD_STATUS_WEBHOOK ]; then export BUILD_STATUS_WEBHOOK="$(cat /run/secrets/BUILD_STATUS_WEBHOOK)"; fi; \
  if [ -f /run/secrets/LOGGER_API_URL ]; then export LOGGER_API_URL="$(cat /run/secrets/LOGGER_API_URL)"; fi; \
  if [ -f /run/secrets/LOGGER_API_KEY ]; then export LOGGER_API_KEY="$(cat /run/secrets/LOGGER_API_KEY)"; fi; \
  bash ./scripts/build.sh

FROM bun-base AS runner

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

WORKDIR /usr/src/app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /usr/src/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/.next/BUILD_ID ./.next/BUILD_ID
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/public ./public
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/scripts ./scripts

USER nextjs

EXPOSE 3000

CMD ["sh", "./scripts/docker-entrypoint.sh", "server.js"]
