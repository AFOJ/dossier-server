// Must contain at least one non-whitespace character, so " " fails too.
const nonEmptyString = { type: "string", minLength: 1, pattern: "\\S" }

export const contactLinkSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "url"],
  properties: {
    label: nonEmptyString,
    url: nonEmptyString,
  },
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
    links: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/definitions/contactLink" },
    },
  },
} as const

export const coverLetterPayloadSchema = {
  $id: "https://dossier-server.local/schemas/cover-letter-payload.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["contact", "date", "body", "closing"],
  properties: {
    contact: { $ref: "#/definitions/contact" },
    date: nonEmptyString,
    subject: nonEmptyString,
    body: {
      type: "array",
      minItems: 1,
      items: nonEmptyString,
    },
    closing: nonEmptyString,
  },

  definitions: {
    contactLink: contactLinkSchema,
    contact: contactSchema,
  },
} as const

export interface ContactLink {
  label: string
  url: string
}

export interface Contact {
  full_name: string
  role?: string
  email?: string
  phone?: string
  location?: string
  links?: ContactLink[]
}

export interface CoverLetterPayload {
  contact: Contact
  date: string
  subject?: string
  body: string[]
  closing: string
}