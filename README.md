<p align="center">
  <h1 align="center">Dossier Server</h1>
</p>

<p align="center">The server behind <a href="https://github.com/AFOJ/dossier">Dossier</a>, a document management tool.</p>

## Development

Requires .NET 10. Tectonic is needed for local PDF rendering; the Docker image includes it.

```bash
dotnet run --project Dossier.Server
```

The server listens on port 3000 by default. Set `CORS_ORIGINS` to a comma-separated list of permitted browser origins.

```bash
dotnet test Dossier.Server.Tests
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The API is available at `http://localhost:3000`; `/health` returns `{"status":"ok"}`.
