import { describe, it, expect } from "vitest"
import { Ajv } from "ajv"
import { coverLetterPayloadSchema, type CoverLetterPayload } from "../src/schemas/cover-letter.js"

const ajv = new Ajv({ strict: false })
const validate = ajv.compile<CoverLetterPayload>(coverLetterPayloadSchema)

const validPayload: CoverLetterPayload = {
  contact: {
    full_name: "John Doe",
    email: "john@example.com",
    phone: "+1 555 0100",
    location: "Berlin, DE",
  },
  date: "September 10, 2026",
  subject: "Re: Application for Senior Engineer",
  body: [
    "Dear Hiring Manager,",
    "I am writing to express my interest in the position.",
    "Thank you for your consideration.",
  ],
  closing: "Sincerely,",
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
    const payload = omit(validPayload, "contact")
    expect(validate(payload)).toBe(false)
  })

  it("rejects missing full_name in contact", () => {
    const payload = {
      ...validPayload,
      contact: { email: "john@example.com" },
    }
    expect(validate(payload)).toBe(false)
  })

  it("rejects missing date", () => {
    const payload = omit(validPayload, "date")
    expect(validate(payload)).toBe(false)
  })

  it("rejects missing body", () => {
    const payload = omit(validPayload, "body")
    expect(validate(payload)).toBe(false)
  })

  it("rejects empty body array", () => {
    const payload = { ...validPayload, body: [] }
    expect(validate(payload)).toBe(false)
  })

  it("rejects missing closing", () => {
    const payload = omit(validPayload, "closing")
    expect(validate(payload)).toBe(false)
  })

  it("accepts optional subject", () => {
    const payload = omit(validPayload, "subject")
    expect(validate(payload)).toBe(true)
  })

  it("accepts contact with only full_name", () => {
    const payload = {
      ...validPayload,
      contact: { full_name: "Jane Smith" },
    }
    expect(validate(payload)).toBe(true)
  })

  it("rejects unknown fields", () => {
    const payload = { ...validPayload, unknownField: "value" }
    expect(validate(payload)).toBe(false)
  })
})
