import type { FastifyInstance } from "fastify"
import cors from "@fastify/cors"

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function registerCors(app: FastifyInstance): void {
  const origins = parseOrigins(process.env.CORS_ORIGINS)

  if (origins.length === 0) {
    app.register(cors, { origin: false })
    return
  }

  app.register(cors, { origin: origins })
}
