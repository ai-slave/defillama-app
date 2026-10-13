# syntax=docker/dockerfile:1.10

# Node and Bun are pinned so an upstream release (for example a new bundled OpenSSL) can't
# change build behavior without a PR. Update the tag and digest together.
FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS node-base

WORKDIR /usr/src/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM node-base AS bun-base

ARG BUN_VERSION=1.4.2
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

FROM bun-base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

FROM bun-base AS builder

# rclone uploads .next/static to the R2 bucket that the load balancer serves missing chunks
# from. Debian bookworm's apt rclone (1.60, from 2022) got 501 NotImplemented from R2 on its
# first upload pass, so a current release is pinned. Update the version and both checksums together.
# The version stays a shell variable: rclone reads every RCLONE_* environment variable as a flag,
# so an ARG or ENV named RCLONE_VERSION becomes --version and crashes every later rclone call.
RUN version=v1.75.2 \
  && case "$(dpkg --print-architecture)" in \
    amd64) arch=amd64; sha=349ac8fba6ff65d6247043f1750cdcb518ec5d500ef91463a10d37c0ccdf3702 ;; \
    arm64) arch=arm64; sha=7e1e8d69654941b7b7df84ee74c5f7fb09cce7d5496947fb7bf16b55ff427d10 ;; \
    *) echo "No pinned rclone for $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
  && curl -fsSLo /tmp/rclone.zip "https://downloads.rclone.org/${version}/rclone-${version}-linux-${arch}.zip" \
  && echo "${sha}  /tmp/rclone.zip" | sha256sum -c - \
  && unzip -j /tmp/rclone.zip "*/rclone" -d /usr/local/bin \
  && rm /tmp/rclone.zip \
  && rclone version

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

# Keep this mount-free: Coolify adds every configured build secret as an
# ephemeral environment-backed secret mount. An explicit mount here prevents
# Coolify from adding the rest of the build environment.
RUN bash ./scripts/build.sh

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
