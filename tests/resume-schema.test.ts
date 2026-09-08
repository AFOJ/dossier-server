import { describe, it, expect } from "vitest"
import { Ajv } from "ajv"
import {
  resumePayloadSchema,
  type ExperienceCompany,
  type ExperienceSection,
  type ListSection,
  type ParagraphSection,
  type ResumePayload,
} from "../src/schemas/resume.js"

const ajv = new Ajv({ strict: false })
const validate = ajv.compile<ResumePayload>(resumePayloadSchema)

export const validPayload: ResumePayload = {
  title: "Backend Engineer Resume",
  contact: {
    full_name: "John Doe",
    role: "Senior Software Engineer",
    email: "john@example.com",
    phone: "+1 555 0100",
    location: "Berlin, DE",
    links: [
      { label: "GitHub", url: "https://github.com/johndoe" },
      { label: "LinkedIn", url: "https://linkedin.com/in/johndoe" },
    ],
  },
  sections: [
    {
      type: "paragraph",
      title: "Profile",
      text: "Seasoned engineer with 8 years of experience.",
    },
    {
      type: "education",
      title: "Education",
      institutions: [
        {
          name: "TU Berlin",
          degree: "BSc Computer Science",
          grade: "1.3",
          start_date: "2014-10-01",
          end_date: "2018-09-30",
          location: "Berlin, DE",
          paragraph: "Thesis on distributed systems.",
        },
      ],
    },
    {
      type: "skills",
      title: "Skills",
      groups: [
        { title: "Languages", items: ["TypeScript", "Python"] },
        { title: "Frameworks", items: ["React", "FastAPI"] },
      ],
    },
    {
      type: "experience",
      title: "Experience",
      companies: [
        {
          company_name: "Acme Corp",
          company_website: "https://acme.com",
          start_date: "2020-01-01",
          end_date: null,
          roles: [
            {
              job_title: "Senior Engineer",
              employment_type: "Full-time",
              location: "Remote",
              start_date: "2020-01-01",
              end_date: "2022-06-30",
              bullets: [
                { type: "text", text: "Led migration to microservices." },
                {
                  type: "text-with-title",
                  title: "Impact",
                  text: "Cut costs by 30%.",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

function paragraphSection(payload: ResumePayload): ParagraphSection {
  const section = payload.sections.find(
    (section): section is ParagraphSection => section.type === "paragraph",
  )
  if (!section) throw new Error("fixture is missing its paragraph section")
  return section
}

function experienceSection(payload: ResumePayload): ExperienceSection {
  const section = payload.sections.find(
    (section): section is ExperienceSection => section.type === "experience",
  )
  if (!section) throw new Error("fixture is missing its experience section")
  return section
}

const firstCompany = (payload: ResumePayload): ExperienceCompany =>
  experienceSection(payload).companies[0]!

describe("resumePayloadSchema", () => {
  it("accepts a fully populated valid payload", () => {
    expect(validate(validPayload)).toBe(true)
  })

  it("accepts minimal payloads with only required fields", () => {
    expect(
      validate({
        title: "Resume",
        contact: { full_name: "John Doe" },
        sections: [],
      }),
    ).toBe(true)
  })

  it("rejects missing section titles", () => {
    const payload = structuredClone(validPayload)
    const section = paragraphSection(payload)
    delete (section as unknown as Record<string, unknown>).title
    expect(validate(payload)).toBe(false)
  })

  it("rejects empty section titles", () => {
    const payload = structuredClone(validPayload)
    paragraphSection(payload).title = ""
    expect(validate(payload)).toBe(false)
  })

  it("rejects whitespace-only strings", () => {
    const payload = structuredClone(validPayload)
    paragraphSection(payload).title = "   "
    expect(validate(payload)).toBe(false)
  })

  it("rejects unknown section types", () => {
    const payload = structuredClone(validPayload)
    payload.sections.push({
      type: "projects",
      title: "Projects",
    } as unknown as (typeof payload)["sections"][number])
    expect(validate(payload)).toBe(false)
  })

  it("rejects titled bullets without a title", () => {
    const payload = structuredClone(validPayload)
    const bullet = firstCompany(payload).roles[0]!.bullets[1]!
    delete (bullet as unknown as Record<string, unknown>).title
    expect(validate(payload)).toBe(false)
  })

  it("rejects untitled bullets carrying a title", () => {
    const payload = structuredClone(validPayload)
    const bullet = firstCompany(payload).roles[0]!.bullets[0]! as unknown as Record<string, unknown>
    bullet.title = "Unexpected"
    expect(validate(payload)).toBe(false)
  })

  it("allows null end_date on experience companies", () => {
    const payload = structuredClone(validPayload)
    firstCompany(payload).end_date = null
    expect(validate(payload)).toBe(true)
  })

  it("rejects unknown properties anywhere in the payload", () => {
    const payload = structuredClone(validPayload) as unknown as Record<string, unknown>
    payload.typo_field = true
    expect(validate(payload)).toBe(false)
  })

  it("accepts roles with no dates", () => {
    const payload = structuredClone(validPayload)
    const role = firstCompany(payload).roles[0]!
    delete role.start_date
    delete role.end_date
    expect(validate(payload)).toBe(true)
  })

  it("rejects roles with a start date but no end date", () => {
    const payload = structuredClone(validPayload)
    firstCompany(payload).roles.push({
      job_title: "Engineer",
      start_date: "2020-01-01",
      bullets: [{ type: "text", text: "Did things." }],
    })
    expect(validate(payload)).toBe(false)
  })

  it("accepts roles with both dates", () => {
    const payload = structuredClone(validPayload)
    firstCompany(payload).roles.push({
      job_title: "Engineer",
      start_date: "2020-01-01",
      end_date: "2021-06-30",
      bullets: [{ type: "text", text: "Did things." }],
    })
    expect(validate(payload)).toBe(true)
  })

  describe("list section", () => {
    const baseListPayload: ResumePayload = {
      title: "Resume",
      contact: { full_name: "John Doe" },
      sections: [
        {
          type: "list",
          title: "Projects",
          items: [
            {
              title: "Project One",
              url: "https://example.com/project1",
              description: "A great project.",
              date: "2023",
            },
          ],
        },
      ],
    }

    it("accepts a valid list section with all fields", () => {
      expect(validate(baseListPayload)).toBe(true)
    })

    it("accepts list section with only required description", () => {
      const payload = structuredClone(baseListPayload)
      const listSection = payload.sections[0] as ListSection
      listSection.items = [{ description: "Just a description." }]
      expect(validate(payload)).toBe(true)
    })

    it("rejects list item with URL but no title", () => {
      const payload = structuredClone(baseListPayload)
      const listSection = payload.sections[0] as ListSection
      listSection.items = [
        { url: "https://example.com", description: "Project with URL only.", date: "2023" },
      ]
      expect(validate(payload)).toBe(false)
    })

    it("rejects list section missing description", () => {
      const payload = structuredClone(baseListPayload)
      const listSection = payload.sections[0] as ListSection
      // @ts-expect-error testing invalid
      delete listSection.items[0].description
      expect(validate(payload)).toBe(false)
    })

    it("rejects list section with unknown property in item", () => {
      const payload = structuredClone(baseListPayload)
      const listSection = payload.sections[0] as ListSection
      // @ts-expect-error testing invalid
      listSection.items[0].unknown_field = "oops"
      expect(validate(payload)).toBe(false)
    })

    it("rejects empty items array", () => {
      const payload = structuredClone(baseListPayload)
      const listSection = payload.sections[0] as ListSection
      listSection.items = []
      expect(validate(payload)).toBe(false)
    })
  })
})
