# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine
ARG TECTONIC_VERSION=0.15.0

# ---------------------------------------------------------------------------
# Build stage: install deps, compile TypeScript, copy templates
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.base.json tsconfig.build.json ./
COPY scripts ./scripts
COPY src ./src
RUN pnpm build

# Drop dev dependencies for the runtime image.
RUN pnpm prune --prod

# ---------------------------------------------------------------------------
# Tectonic stage: fetch the pinned static binary
# ---------------------------------------------------------------------------
FROM alpine:3.21 AS tectonic
ARG TECTONIC_VERSION
RUN apk add --no-cache tar \
 && wget -qO- "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 | tar -xz -C /usr/local/bin \
 && chmod +x /usr/local/bin/tectonic

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}

# XeTeX (tectonic) needs fontconfig for font discovery.
RUN apk add --no-cache fontconfig

ENV NODE_ENV=production
EXPOSE 3000

RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=tectonic /usr/local/bin/tectonic /usr/local/bin/tectonic

USER app

# Warm tectonic's bundle cache by compiling a static document that mirrors
# the templates' preamble and exercises every macro the partials emit, so
# every package a real resume needs is baked into the image and runtime
# compilation never touches the network.
#
# This step deliberately does NOT depend on src/: it sits above the dist
# copies so application code changes keep the warmed cache layer cached.
# If you change the templates' packages or macros, update scripts/warmup.tex
# to match (package parity is enforced by tests/template.test.ts).
COPY --chown=app:app scripts/warmup.tex ./warmup.tex
RUN cp warmup.tex /tmp/main.tex && cd /tmp && tectonic --keep-logs main.tex \
 && rm -f main.tex main.pdf main.log

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
