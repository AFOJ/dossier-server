// Must contain at least one non-whitespace character, so " " fails too.
const nonEmptyString = { type: "string", minLength: 1, pattern: "\\S" }

export const nullableNonEmptyString = {
  anyOf: [nonEmptyString, { type: "null" }],
} as const

export const contactSchema = {
  type: "object",
  additionalProperties: false,
  required: ["full_name"],
  properties: {
    full_name: nonEmptyString,
    role: nonEmptyString,
    email: nonEmptyString,
    phone: nonEmptyString,
    location: nonEmptyString,
  },
} as const

export const coverLetterPayloadSchema = {
  $id: "https://dossier-server.local/schemas/cover-letter-payload.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["contact", "body"],
  properties: {
    // Accepted for FE compatibility; ignored when rendering the PDF.
    title: nullableNonEmptyString,
    contact: { $ref: "#/definitions/contact" },
    date: nullableNonEmptyString,
    subject: nullableNonEmptyString,
    // Single rich-text HTML string from the editor (e.g. TipTap).
    body: nonEmptyString,
    signoff: nullableNonEmptyString,
  },

  definitions: {
    contact: contactSchema,
  },
} as const

export interface Contact {
  full_name: string
  role?: string
  email?: string
  phone?: string
  location?: string
}

export interface CoverLetterPayload {
  /** Accepted for FE compatibility; ignored when rendering. */
  title?: string | null
  contact: Contact
  date?: string | null
  subject?: string | null
  /** Rich-text HTML string from the editor. */
  body: string
  signoff?: string | null
}
