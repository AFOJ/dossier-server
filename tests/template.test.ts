import { describe, it, expect } from "vitest"
import { renderResume } from "../src/services/template.js"
import type { ExperienceCompany, ResumePayload } from "../src/schemas/resume.js"

const payloadFixture: ResumePayload = {
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
      text: "Seasoned engineer with 8 years of experience & a focus on R&D.",
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
        {
          company_name: "Globex",
          roles: [
            {
              job_title: "Engineer",
              bullets: [{ type: "text", text: "Built things." }],
            },
          ],
        },
      ],
    },
    {
      type: "skills",
      title: "Skills",
      groups: [
        { title: "Languages", items: ["TypeScript", "Python"] },
        { title: "Databases", items: ["PostgreSQL"] },
      ],
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
  ],
}

/** Collapses whitespace so assertions are layout-insensitive. */
function squash(value: string): string {
  return value.replace(/\s+/g, " ")
}

describe("renderResume", () => {
  const firstCompany = (p: ResumePayload): ExperienceCompany => {
    const section = p.sections.find((s) => s.type === "experience")
    if (section?.type !== "experience") throw new Error("missing experience section")
    const company = section.companies[0]
    if (!company) throw new Error("missing experience company")
    return company
  }

  it("produces a complete LaTeX document skeleton", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\documentclass[letterpaper,10.8pt]{article}")
    expect(tex).toContain("\\begin{document}")
    expect(tex).toContain("\\end{document}")
  })

  it("renders the header from contact details", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\textbf{\\LARGE {John Doe}}")
    expect(tex).toContain("\\href{mailto:john@example.com}{john@example.com}")
    expect(tex).toContain("\\href{https://github.com/johndoe}{GitHub}")
    expect(tex).toContain("{Senior Software Engineer} & {Berlin, DE}")
  })

  it("escapes user-provided strings exactly once", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("experience \\& a focus on R\\&D.")
    expect(tex).toContain("Cut costs by 30\\%.")
  })

  it("maps text-with-title bullets to \\resumeItem", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\resumeItem{Impact}{Cut costs by 30\\%.}")
  })

  it("maps untitled bullets to \\resumeItemWithoutTitle", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\resumeItemWithoutTitle {Led migration to microservices.}")
  })

  it("uses employerTitle for companies with a website", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\employerTitle {https://acme.com}{Acme Corp}{2020-01-01}")
  })

  it("uses employerTitlePlain for companies without a website", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\employerTitlePlain {Globex}{}")
  })

  it("composes role lines with employment type and location", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("{Senior Engineer (Full-time, Remote)}")
  })

  it("renders a single detail without trailing comma", () => {
    const payload = structuredClone(payloadFixture)
    delete firstCompany(payload).roles[0]!.location
    const tex = squash(renderResume(payload))
    expect(tex).toContain("{Senior Engineer (Full-time)}")
  })

  it("omits parentheses entirely when a role has no extra details", () => {
    const payload = structuredClone(payloadFixture)
    const role = firstCompany(payload).roles[0]!
    delete role.employment_type
    delete role.location
    const tex = squash(renderResume(payload))
    expect(tex).toContain("\\jobLineItem {Senior Engineer}{2020-01-01 - 2022-06-30}")
    expect(tex).not.toContain("()")
  })

  it("renders role dates in the right-aligned slot", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toMatch(/\{Senior Engineer \(Full-time, Remote\)\}\{2020-01-01 - 2022-06-30\}/)
  })

  it("omits date args for entries without dates", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\jobLineItem {Engineer}{}")
  })

  it("joins skill items with commas", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\resumeSubItem{Languages}{TypeScript, Python}")
  })

  it("appends grades to education degrees", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("{BSc Computer Science (1.3)}")
  })

  it("renders thesis paragraphs as untitled bullets under education", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\resumeItemWithoutTitle {Thesis on distributed systems.}")
  })

  it("renders sections in payload order", () => {
    const tex = squash(renderResume(payloadFixture))
    const profileIdx = tex.indexOf("\\section{Profile}")
    const experienceIdx = tex.indexOf("\\section{Experience}")
    const skillsIdx = tex.indexOf("\\section{Skills}")
    const educationIdx = tex.indexOf("\\section{Education}")
    expect(profileIdx).toBeGreaterThan(-1)
    expect(experienceIdx).toBeGreaterThan(profileIdx)
    expect(skillsIdx).toBeGreaterThan(experienceIdx)
    expect(educationIdx).toBeGreaterThan(skillsIdx)
  })
})
