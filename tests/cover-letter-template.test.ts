import { describe, it, expect } from "vitest"
import { renderCoverLetter } from "../src/services/template.js"
import type { CoverLetterPayload } from "../src/schemas/cover-letter.js"

const basePayload: CoverLetterPayload = {
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
    "I am writing to express my interest in the Senior Engineer position at Acme Corp. With 8 years of experience & a focus on R&D, I am confident I can contribute immediately.",
    "In my current role at TechCorp, I led the migration to microservices, reducing deployment time by 70% and improving system reliability. I also mentored 5 junior engineers.",
    "I would welcome the opportunity to discuss how my background aligns with Acme's goals. Thank you for your time and consideration.",
  ],
  closing: "Sincerely,",
}

function squash(value: string): string {
  return value.replace(/\s+/g, " ")
}

function omit<T, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _, ...rest } = obj
  return rest
}

describe("renderCoverLetter", () => {
  it("produces a complete LaTeX document skeleton", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{article}")
    expect(tex).toContain("\\begin{document}")
    expect(tex).toContain("\\end{document}")
  })

  it("renders centered name in bold LARGE", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\begin{center}{\\LARGE \\textbf{John Doe}}\\end{center}")
  })

  it("renders centered contact line with email, phone, location", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\begin{center}")
    expect(tex).toContain("\\texttt{john@example.com}")
    expect(tex).toContain("\\texttt{+1 555 0100}")
    expect(tex).toContain("\\texttt{Berlin, DE}")
    expect(tex).toContain("\\end{center}")
  })

  it("renders hrule divider after contact", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\vspace{4pt}\\hrule\\vspace{12pt}")
  })

  it("renders date line", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent September 10, 2026 \\\\[6pt]")
  })

  it("renders subject line in bold", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent \\textbf{Re: Application for Senior Engineer} \\\\[12pt]")
  })

  it("renders body paragraphs", () => {
    const tex = squash(renderCoverLetter(basePayload))
    // uses \noindent for each paragraph
    expect(tex).toContain("\\noindent Dear Hiring Manager, \\\\[6pt]")
    expect(tex).toContain(
      "\\noindent I am writing to express my interest in the Senior Engineer position at Acme Corp. With 8 years of experience \\& a focus on R\\&D, I am confident I can contribute immediately. \\\\[6pt]",
    )
    expect(tex).toContain(
      "\\noindent In my current role at TechCorp, I led the migration to microservices, reducing deployment time by 70\\% and improving system reliability. I also mentored 5 junior engineers. \\\\[6pt]",
    )
    expect(tex).toContain(
      "\\noindent I would welcome the opportunity to discuss how my background aligns with Acme's goals. Thank you for your time and consideration. \\\\[6pt]",
    )
  })

  it("renders closing and signature", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent Sincerely, \\\\")
    expect(tex).toContain("\\noindent John Doe")
  })

  it("escapes user-provided strings exactly once", () => {
    const payload = {
      ...basePayload,
      body: ["Special chars: & % $ # _ { } ~ ^ \\"],
    }
    const tex = squash(renderCoverLetter(payload))
    // escape-latex uses \textasciitilde{} and \textasciicircum{} for ~ and ^
    expect(tex).toContain(
      "\\& \\% \\$ \\# \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    )
  })

  it("omits contact line when no email/phone/location", () => {
    const payload = {
      ...basePayload,
      contact: { full_name: "Jane Smith" },
    }
    const tex = squash(renderCoverLetter(payload))
    // name is still centered, but no second center for contact line
    expect(tex).not.toContain("\\texttt")
    // count center environments - should be 1 (name only)
    const centerCount = (tex.match(/\\begin\{center\}/g) || []).length
    expect(centerCount).toBe(1)
  })

  it("omits subject line when not provided", () => {
    const payload = omit(basePayload, "subject")
    const tex = squash(renderCoverLetter(payload))
    expect(tex).not.toContain("Re: Application")
    // \textbf is still used for name, so check specifically for subject
    expect(tex).not.toContain("\\noindent\\textbf{")
  })

  it("handles contact with only email", () => {
    const payload = {
      ...basePayload,
      contact: { full_name: "Jane Smith", email: "jane@example.com" },
    }
    const tex = squash(renderCoverLetter(payload))
    expect(tex).toContain("\\texttt{jane@example.com}")
    expect(tex).not.toContain("+1 555")
    expect(tex).not.toContain("Berlin")
  })

  it("renders multiple body paragraphs correctly", () => {
    const payload = {
      ...basePayload,
      body: ["Paragraph 1.", "Paragraph 2.", "Paragraph 3."],
    }
    const tex = squash(renderCoverLetter(payload))
    expect(tex).toContain("\\noindent Paragraph 1. \\\\[6pt]")
    expect(tex).toContain("\\noindent Paragraph 2. \\\\[6pt]")
    expect(tex).toContain("\\noindent Paragraph 3. \\\\[6pt]")
  })
})
