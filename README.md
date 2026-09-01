<p align="center">
  <h1 align="center">Dossier (Backend)</h1>
</p>

<p align="center">The server behind <a href="https://github.com/AFOJ/dossier">Dossier</a>, a resume management tool.</p>

Right now that means turning a resume payload into a PDF. More is coming.

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 22
- [pnpm](https://pnpm.io) ≥ 10
- [Docker](https://www.docker.com) + Docker Compose v2

> No local LaTeX installation needed — the Docker image embeds tectonic, fonts, and a pre-warmed package cache.

## Installation

```bash
git clone git@github.com:AFOJ/dossier-server.git
cd dossier-server
```

```bash
pnpm install
```

## Getting Started (Docker)

```bash
cp .env.example .env
```

```bash
docker compose up --build -d
```

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

**When to rebuild:** `docker compose up --build -d` after code changes.

**Run in foreground (see logs, Ctrl+C to stop):** `docker compose up`

**Run detached (background):** `docker compose up -d`

## Local Development

```bash
cp .env.example .env
```

```bash
pnpm dev
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

```bash
pnpm lint
```

## Testing

```bash
pnpm test
```

```bash
pnpm test:watch
```

Integration tests require tectonic on `PATH`; otherwise skipped.