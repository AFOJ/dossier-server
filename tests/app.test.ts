import { buildApp } from "../src/app.js"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"

describe("app", () => {
  let app: FastifyInstance

  beforeAll(() => {
    app = buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("responds to /health with ok status", async () => {
    const res = await app.inject({ method: "GET", url: "/health" })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok" })
  })

  it("returns 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/unknown" })

    expect(res.statusCode).toBe(404)
  })
})
