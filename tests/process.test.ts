import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import type { FastifyInstance } from "fastify"
import type * as LatexService from "../src/services/latex.js"
import { buildApp } from "../src/app.js"
import { LaTeXCompileError } from "../src/responses.js"

const FAKE_PDF = Buffer.from("%PDF-fake-resume")
const PROCESS_URL = "/api/resumes/process"

vi.mock("../src/services/latex.js", async (importOriginal) => {
  const actual = await importOriginal<typeof LatexService>()
  return {
    ...actual,
    compileLatex: vi.fn(async () => FAKE_PDF),
  }
})

import { compileLatex } from "../src/services/latex.js"

// Minimal payload that passes schema validation (header-only resume).
const validPayload = {
  title: "Backend Engineer Resume",
  contact: { full_name: "John Doe" },
  sections: [],
}

beforeEach(() => {
  vi.mocked(compileLatex).mockReset()
  vi.mocked(compileLatex).mockResolvedValue(FAKE_PDF)
})

describe("POST /api/resumes/process", () => {
  let app: FastifyInstance

  beforeAll(() => {
    app = buildApp()
  })

  afterAll(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  it("returns the compiled PDF for a valid payload", async () => {
    const res = await app.inject({ method: "POST", url: PROCESS_URL, payload: validPayload })

    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toMatch(/^application\/pdf/)
    expect(res.headers["content-disposition"]).toContain("inline")
    expect(res.body).toEqual(FAKE_PDF.toString())
  })

  it("rejects invalid payloads with a validation envelope naming the fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: PROCESS_URL,
      payload: { title: "", contact: {}, sections: [] },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(body.error.details.length).toBeGreaterThan(0)
    expect(body.error.details[0]).toHaveProperty("path")
    expect(body.error.details[0]).toHaveProperty("message")
  })

  it("maps compile failures to a COMPILE_ERROR envelope carrying the log excerpt", async () => {
    vi.mocked(compileLatex).mockRejectedValueOnce(
      new LaTeXCompileError("tectonic exited with an error", "./main.tex:42: Missing $ inserted."),
    )

    const res = await app.inject({ method: "POST", url: PROCESS_URL, payload: validPayload })

    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe("COMPILE_ERROR")
    expect(body.error.details[0]).toContain("Missing $ inserted.")
  })

  it("keeps unexpected failures opaque to the client", async () => {
    vi.mocked(compileLatex).mockRejectedValueOnce(new Error("disk on fire"))

    const res = await app.inject({ method: "POST", url: PROCESS_URL, payload: validPayload })

    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(JSON.stringify(body)).not.toContain("disk on fire")
  })

  it("wraps unknown routes in the same envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe("NOT_FOUND")
  })
})
