import { describe, it, expect } from "vitest"
import { Ajv } from "ajv"
import { coverLetterPayloadSchema, type CoverLetterPayload } from "../src/schemas/cover-letter.js"

const ajv = new Ajv({ strict: false })
const validate = ajv.compile<CoverLetterPayload>(coverLetterPayloadSchema)

const validPayload: CoverLetterPayload = {
  title: "Backend Engineer — Acme Corp",
  contact: {
    full_name: "Jane Doe",
    role: "Backend Engineer",
    email: "jane.doe@example.com",
    location: "London, UK",
  },
  date: "2026-09-12",
  subject: "Application for Backend Engineer (Ref: BE-2026-042)",
  body: "<p>Dear Hiring Manager,</p><p>I am writing to apply for the <strong>backend engineer</strong> role.</p>",
  signoff: "Yours sincerely,",
}

function omit<T, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _, ...rest } = obj
  return rest
}

describe("coverLetterPayloadSchema", () => {
  it("accepts a valid payload", () => {
    expect(validate(validPayload)).toBe(true)
  })

  it("rejects missing contact", () => {
    expect(validate(omit(validPayload, "contact"))).toBe(false)
  })

  it("rejects missing full_name in contact", () => {
    const payload = {
      ...validPayload,
      contact: { email: "jane@example.com" },
    }
    expect(validate(payload)).toBe(false)
  })

  it("rejects missing body", () => {
    expect(validate(omit(validPayload, "body"))).toBe(false)
  })

  it("rejects an empty body string", () => {
    expect(validate({ ...validPayload, body: "   " })).toBe(false)
  })

  it("rejects the legacy body array shape", () => {
    const payload = { ...validPayload, body: ["Dear Hiring Manager,"] }
    expect(validate(payload)).toBe(false)
  })

  it("rejects the legacy closing field", () => {
    const payload = { ...validPayload, closing: "Sincerely," }
    expect(validate(payload)).toBe(false)
  })

  it("accepts missing title, date, subject, and signoff", () => {
    const payload = {
      contact: { full_name: "Jane Doe" },
      body: "<p>Hello.</p>",
    }
    expect(validate(payload)).toBe(true)
  })

  it("accepts null title, date, subject, and signoff", () => {
    const payload = {
      ...validPayload,
      title: null,
      date: null,
      subject: null,
      signoff: null,
    }
    expect(validate(payload)).toBe(true)
  })

  it("accepts contact with only full_name", () => {
    const payload = {
      ...validPayload,
      contact: { full_name: "Jane Smith" },
    }
    expect(validate(payload)).toBe(true)
  })

  it("rejects contact links (not rendered on cover letters)", () => {
    const payload = {
      ...validPayload,
      contact: {
        ...validPayload.contact,
        links: [{ label: "GitHub", url: "https://github.com/janedoe" }],
      },
    }
    expect(validate(payload)).toBe(false)
  })

  it("rejects unknown fields", () => {
    const payload = { ...validPayload, unknownField: "value" }
    expect(validate(payload)).toBe(false)
  })
})
