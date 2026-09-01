<p align="center">
  <h1 align="center">Dossier (Backend)</h1>
</p>

<p align="center">The server behind <a href="https://github.com/AFOJ/dossier">Dossier</a>, a resume management tool.</p>

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

**Rebuild after code changes:** `docker compose up --build -d`

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