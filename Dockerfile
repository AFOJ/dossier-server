# syntax=docker/dockerfile:1
ARG TECTONIC_VERSION=0.15.0

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY Dossier.csproj ./
RUN dotnet restore Dossier.csproj
COPY Program.cs ./
COPY Api/ Api/
COPY Documents/ Documents/
COPY Pdf/ Pdf/
COPY Validation/ Validation/
COPY Schemas/ Schemas/
COPY Templates/ Templates/
RUN dotnet publish Dossier.csproj -c Release -o /out --no-restore

FROM alpine:3.21 AS tectonic
ARG TECTONIC_VERSION
RUN apk add --no-cache tar \
 && wget -qO- "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 | tar -xz -C /usr/local/bin \
 && chmod +x /usr/local/bin/tectonic

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
RUN apk add --no-cache fontconfig curl
WORKDIR /app
COPY --from=tectonic /usr/local/bin/tectonic /usr/local/bin/tectonic
USER app
COPY --chown=app:app scripts/warmup.tex /app/warmup.tex
RUN cp /app/warmup.tex /tmp/main.tex && cd /tmp && tectonic --keep-logs main.tex \
 && rm -f /tmp/main.tex /tmp/main.pdf /tmp/main.log
COPY --from=build --chown=app:app /out/ /app/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/health" >/dev/null || exit 1
CMD ["sh", "-c", "ASPNETCORE_URLS=http://${HOST:-0.0.0.0}:${PORT:-3000} exec dotnet Dossier.dll"]
