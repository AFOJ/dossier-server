import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
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
      type: "projects",
      title: "Projects",
      projects: [
        {
          name: "Fermentation Monitor",
          url: "https://github.com/johndoe/fermentation-monitor",
          technologies: ["TypeScript", "React", "PostgreSQL"],
          start_date: "2024-01-01",
          end_date: "2025-06-30",
          bullets: [
            { type: "text", text: "Built a real-time sensor dashboard." },
            { type: "text-with-title", title: "Impact", text: "Cut costs by 30%." },
          ],
        },
        {
          name: "Side Project",
          technologies: [],
          bullets: [],
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
    const section = p.sections.find((section) => section.type === "experience")
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

  it("renders project headings with optional links, technologies, dates, and bullets", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain(
      "\\resumeProjectHeading{\\href{https://github.com/johndoe/fermentation-monitor}{\\textbf{Fermentation Monitor}} $|$ \\emph{TypeScript, React, PostgreSQL}}{2024-01-01 - 2025-06-30}",
    )
    expect(tex).toContain("\\resumeItemWithoutTitle {Built a real-time sensor dashboard.}")
    expect(tex).toContain("\\resumeItem{Impact}{Cut costs by 30\\%.}")
    expect(tex).toContain("\\resumeProjectHeading{\\textbf{Side Project}}{}")
  })

  it("joins skill items with commas", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\resumeSubItem{Languages}{TypeScript, Python}")
  })

  it("appends grades to education degrees", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("{BSc Computer Science (1.3)}")
  })

  it("renders thesis paragraphs as plain text under education", () => {
    const tex = squash(renderResume(payloadFixture))
    expect(tex).toContain("\\par {Thesis on distributed systems.}")
  })

  it("renders sections in payload order", () => {
    const tex = squash(renderResume(payloadFixture))
    const profileIdx = tex.indexOf("\\section{Profile}")
    const experienceIdx = tex.indexOf("\\section{Experience}")
    const projectsIdx = tex.indexOf("\\section{Projects}")
    const skillsIdx = tex.indexOf("\\section{Skills}")
    const educationIdx = tex.indexOf("\\section{Education}")
    expect(profileIdx).toBeGreaterThan(-1)
    expect(experienceIdx).toBeGreaterThan(profileIdx)
    expect(projectsIdx).toBeGreaterThan(experienceIdx)
    expect(skillsIdx).toBeGreaterThan(projectsIdx)
    expect(educationIdx).toBeGreaterThan(skillsIdx)
  })

  it("warmup.tex caches every package the templates use", () => {
    // The Docker build warms tectonic's package cache from scripts/warmup.tex,
    // which must therefore load every package the rendered document loads.
    const tex = renderResume(payloadFixture)
    const used = new Set(
      [...tex.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/g)].flatMap(
        (m) => m[1]?.split(",").map((pkg) => pkg.trim()) ?? [],
      ),
    )
    const warmup = readFileSync(new URL("../scripts/warmup.tex", import.meta.url), "utf8")
    for (const pkg of used) {
      expect(warmup, `scripts/warmup.tex is missing \\usepackage{${pkg}}`).toContain(`{${pkg}}`)
    }
  })
})
