import { buildApp } from "../src/app.js"
import { afterEach, describe, expect, it } from "vitest"

describe("cors", { timeout: 15000 }, () => {
  afterEach(() => {
    delete process.env.CORS_ORIGINS
  })

  it("refuses cross-origin requests when CORS_ORIGINS is unset", async () => {
    const app = buildApp()

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://app.example.com" },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
    await app.close()
  })

  it("allows listed origins and answers their preflights", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com"
    const app = buildApp()

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

    await app.close()
  })

  it("ignores origins outside the list", async () => {
    process.env.CORS_ORIGINS = "https://app.example.com"
    const app = buildApp()

    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example.com" },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
    await app.close()
  })
})
