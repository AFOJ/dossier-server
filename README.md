<p align="center">
  <h1 align="center">Dossier (Backend)</h1>
</p>

<p align="center">The server behind <a href="https://github.com/AFOJ/dossier">Dossier</a>, a resume management tool.</p>

Right now that means turning a resume payload into a PDF. More is coming.

## Installation

Requires [Node.js](https://nodejs.org), [pnpm](https://pnpm.io) and [Docker](https://www.docker.com).

```bash
git clone git@github.com:AFOJ/dossier-server.git
```

```bash
cd dossier-server
```

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

```bash
pnpm test
```

Compilation happens inside Docker (tectonic + fonts + a pre-warmed package cache are baked into the image), so you don't need a LaTeX installation locally.

## Try it

```bash
docker compose up
```

```bash
cp .env.example .env
```

Then, from a second terminal:

PowerShell:

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/resumes/process -Method Post -ContentType "application/json" -InFile examples/resume-payload.json -OutFile resume.pdf
```

bash / zsh:

```bash
curl -X POST http://localhost:3000/api/resumes/process \
  -H "Content-Type: application/json" \
  --data "@examples/resume-payload.json" \
  --output resume.pdf
```
