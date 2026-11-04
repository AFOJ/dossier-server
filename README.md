<h1 align="center">Dossier Server</h1>

<p align="center">The server behind <a href="https://github.com/AFOJ/dossier">Dossier</a>, a document management tool.</p>

## About

Dossier Server is a stateless service for handling server-side operations for the Dossier project. It processes requests and returns results without storing your documents.

## Development

This server is built with C# and ASP.NET Core. You need .NET 10 and Tectonic to run it locally. The Docker image includes Tectonic.

To run it locally:

```bash
# Clone the repository
git clone https://github.com/AFOJ/dossier-server.git

# Change to the project directory
cd dossier-server

# Run the server
dotnet run
```

The server listens on port 3000. Set `CORS_ORIGINS` to allow browser origins, for example `http://localhost:5173`.

Example request bodies are in [`examples`](./examples/). From the repository root, you can try one with:

```bash
curl -X POST http://localhost:3000/api/resumes/process \
  -H 'Content-Type: application/json' \
  --data-binary @examples/resume-payload.json \
  --output resume.pdf
```

Replace `resumes` and `resume-payload.json` with `cover-letters` and `cover-letter-payload.json` to try the other example.

### Testing

Tests live in `Dossier.Tests` and check API and document behaviour. From the repository root, run:

```bash
# Run tests
dotnet test Dossier.Tests

# Restore the pinned formatter
dotnet tool restore

# Format the whole codebase
dotnet csharpier format .

# Check codebase formatting
dotnet csharpier check .

# Build the server and check analyser warnings
dotnet build -warnaserror
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```
