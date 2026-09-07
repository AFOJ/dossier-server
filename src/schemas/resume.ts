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

export const paragraphSectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "text"],
  properties: {
    type: { const: "paragraph" },
    title: nonEmptyString,
    text: nonEmptyString,
  },
} as const

export const educationSectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "institutions"],
  properties: {
    type: { const: "education" },
    title: nonEmptyString,
    institutions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "degree"],
        properties: {
          name: nonEmptyString,
          degree: nonEmptyString,
          grade: nonEmptyString,
          start_date: nonEmptyString,
          end_date: nonEmptyString,
          location: nonEmptyString,
          paragraph: nonEmptyString,
        },
      },
    },
  },
} as const

export const skillsSectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "groups"],
  properties: {
    type: { const: "skills" },
    title: nonEmptyString,
    groups: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "items"],
        properties: {
          title: nonEmptyString,
          items: {
            type: "array",
            minItems: 1,
            items: nonEmptyString,
          },
        },
      },
    },
  },
} as const

export const experienceSectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "companies"],
  properties: {
    type: { const: "experience" },
    title: nonEmptyString,
    companies: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company_name", "roles"],
        properties: {
          company_name: nonEmptyString,
          company_website: nonEmptyString,
          start_date: nonEmptyString,
          end_date: { anyOf: [nonEmptyString, { type: "null" }] },
          roles: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["job_title", "bullets"],
              properties: {
                job_title: nonEmptyString,
                employment_type: nonEmptyString,
                location: nonEmptyString,
                // Role dates are all-or-nothing: enforced by if/then below.
                start_date: nonEmptyString,
                end_date: nonEmptyString,
                bullets: {
                  type: "array",
                  minItems: 0,
                  items: { $ref: "#/definitions/bullet" },
                },
              },
              if: { required: ["start_date"] },
              then: { required: ["end_date"] },
            },
          },
        },
      },
    },
  },
} as const

export const bulletSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { const: "text" },
        text: nonEmptyString,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "title", "text"],
      properties: {
        type: { const: "text-with-title" },
        title: nonEmptyString,
        text: nonEmptyString,
      },
    },
  ],
} as const

export const listItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["description"],
  properties: {
    title: nonEmptyString,
    url: nonEmptyString,
    description: nonEmptyString,
    date: nonEmptyString,
  },
  if: { required: ["url"] },
  then: { required: ["title"] },
} as const

export const listSectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "items"],
  properties: {
    type: { const: "list" },
    title: nonEmptyString,
    items: { type: "array", minItems: 1, items: { $ref: "#/definitions/listItem" } },
  },
} as const

export const sectionSchema = {
  oneOf: [
    { $ref: "#/definitions/paragraphSection" },
    { $ref: "#/definitions/educationSection" },
    { $ref: "#/definitions/skillsSection" },
    { $ref: "#/definitions/experienceSection" },
    { $ref: "#/definitions/listSection" },
  ],
} as const

export const resumePayloadSchema = {
  $id: "https://dossier-server.local/schemas/resume-payload.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["title", "contact", "sections"],
  properties: {
    title: nonEmptyString,
    contact: { $ref: "#/definitions/contact" },
    sections: {
      type: "array",
      items: { $ref: "#/definitions/section" },
    },
  },

  definitions: {
    contactLink: contactLinkSchema,
    contact: contactSchema,
    section: sectionSchema,
    paragraphSection: paragraphSectionSchema,
    educationSection: educationSectionSchema,
    skillsSection: skillsSectionSchema,
    experienceSection: experienceSectionSchema,
    bullet: bulletSchema,
    listItem: listItemSchema,
    listSection: listSectionSchema,
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

export interface ParagraphSection {
  type: "paragraph"
  title: string
  text: string
}

export interface EducationInstitution {
  name: string
  degree: string
  grade?: string
  start_date?: string
  end_date?: string
  location?: string
  /** Optional note rendered under the entry, e.g. thesis summary. */
  paragraph?: string
}

export interface EducationSection {
  type: "education"
  title: string
  institutions: EducationInstitution[]
}

export interface SkillGroup {
  title: string
  items: string[]
}

export interface SkillsSection {
  type: "skills"
  title: string
  groups: SkillGroup[]
}

export type Bullet =
  { type: "text"; text: string } | { type: "text-with-title"; title: string; text: string }

export interface ListItem {
  title?: string
  url?: string
  description: string
  date?: string
}

export interface ListSection {
  type: "list"
  title: string
  items: ListItem[]
}

export interface ExperienceRole {
  job_title: string
  employment_type?: string
  location?: string
  /** All-or-nothing pair: schema rejects start without end. */
  start_date?: string
  end_date?: string
  bullets: Bullet[]
}

export interface ExperienceCompany {
  company_name: string
  company_website?: string
  start_date?: string
  /** null = no explicit end date; "PRESENT" renders the current-job marker. */
  end_date?: string | null
  roles: ExperienceRole[]
}

export interface ExperienceSection {
  type: "experience"
  title: string
  companies: ExperienceCompany[]
}

export type Section = ParagraphSection | EducationSection | SkillsSection | ExperienceSection | ListSection

export interface ResumePayload {
  title: string
  contact: Contact
  sections: Section[]
}
