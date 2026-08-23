import { describe, it, expect } from "vitest"
import { renderResume } from "../src/services/template.js"
import { compileLatex, isTectonicAvailable } from "../src/services/latex.js"
import type { ResumePayload } from "../src/schemas/resume.js"

const payload: ResumePayload = {
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
              bullets: [
                { type: "text", text: "Led migration to microservices." },
                {
                  type: "text-with-title",
                  title: "Impact & Savings",
                  text: "Cut costs by 30% and saved $5k (Q1_2026).",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "skills",
      title: "Skills",
      groups: [{ title: "Languages", items: ["TypeScript", "Python"] }],
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
        },
      ],
    },
  ],
}

// Only meaningful where tectonic is installed (CI image, dev machines).
const tectonicReady = await isTectonicAvailable()

describe.skipIf(!tectonicReady)("LaTeX integration (real tectonic)", () => {
  it(
    "compiles the full resume fixture into a real PDF",
    async () => {
      const tex = renderResume(payload)
      const pdf = await compileLatex(tex)

      expect(pdf.subarray(0, 4).toString()).toBe("%PDF")
      // A one-page resume should never be tiny; guards against empty docs.
      expect(pdf.length).toBeGreaterThan(10_000)
    },
    { timeout: 60_000 },
  )

  it(
    "rejects LaTeX-invalid content with a diagnostic error",
    async () => {
      const broken = renderResume(payload).replace(
        "\\begin{document}",
        "\\begin{document}\n\\notARealCommand",
      )
      await expect(compileLatex(broken)).rejects.toThrow()
    },
    { timeout: 60_000 },
  )
})
