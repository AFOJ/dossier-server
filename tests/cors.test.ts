import { buildApp } from "../src/app.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { FastifyInstance } from "fastify"

let app: FastifyInstance | undefined

function resetEnv(): void {
  delete process.env.CORS_ORIGINS
}

beforeEach(resetEnv)
afterEach(async () => {
  resetEnv()
  if (app) {
    await app.close()
    app = undefined
  }
})

describe("cors", { timeout: 15000 }, () => {
  it("omits Access-Control-Allow-Origin when CORS_ORIGINS is unset", async () => {
    app = await buildApp()

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://app.example.com" },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("reflects an allow-listed origin and answers its preflights", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com"
    app = await buildApp()

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://app.example.com" },
    })
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com")

    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/resumes/process",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
      },
    })
    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers["access-control-allow-methods"]).toContain("POST")
  })

  it("omits Access-Control-Allow-Origin for origins outside the list", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com"
    app = await buildApp()

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example.com" },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("omits Access-Control-Allow-Origin on preflights from unlisted origins", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com"
    app = await buildApp()

    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/resumes/process",
      headers: {
        origin: "https://evil.example.com",
        "access-control-request-method": "POST",
      },
    })

    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined()
  })
})
