import { describe, it, expect } from "vitest"
import { renderCoverLetter } from "../src/services/template.js"
import type { CoverLetterPayload } from "../src/schemas/cover-letter.js"

const basePayload: CoverLetterPayload = {
  title: "Backend Engineer — Acme Corp",
  contact: {
    full_name: "Jane Doe",
    role: "Backend Engineer",
    email: "jane.doe@example.com",
    location: "London, UK",
  },
  date: "2026-09-12",
  subject: "Application for Backend Engineer (Ref: BE-2026-042)",
  body: '<p>Dear Hiring Manager,</p><p>I was excited to see your posting for a <strong>backend engineer</strong> with payments experience.</p><p>First I cut p99 latency 40% on our <a href="https://example.com/case-study?ref=letter&amp;utm=1">settlement pipeline</a>; second, you can reach me <a href="mailto:jane.doe@example.com">by email</a>.</p><p>Markup I typed as plain text renders literally: &lt;div&gt;.</p><p><br></p><p>An empty paragraph sits above this line, and<br>this breaks mid-paragraph.</p>',
  signoff: "Yours sincerely,",
}

function squash(value: string): string {
  return value.replace(/\s+/g, " ")
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
    expect(tex).toContain("\\begin{center}{\\LARGE \\textbf{Jane Doe}}\\end{center}")
  })

  it("renders role under the name", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\begin{center}\\textit{Backend Engineer}\\end{center}")
  })

  it("renders contact row with hyperlinked email and location", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\texttt{\\href{mailto:jane.doe@example.com}{jane.doe@example.com}}")
    expect(tex).toContain("\\texttt{London, UK}")
  })

  it("renders hrule divider after the header", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\vspace{4pt}\\hrule\\vspace{12pt}")
  })

  it("renders date line", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent 2026-09-12 \\\\[6pt]")
  })

  it("renders subject line in bold", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain(
      "\\noindent \\textbf{Application for Backend Engineer (Ref: BE-2026-042)} \\\\[12pt]",
    )
  })

  it("renders body paragraphs with bold and links", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent Dear Hiring Manager, \\\\[6pt]")
    expect(tex).toContain("\\textbf{backend engineer}")
    expect(tex).toContain(
      "\\href{https://example.com/case-study?ref=letter\\&utm=1}{settlement pipeline}",
    )
    expect(tex).toContain("\\href{mailto:jane.doe@example.com}{by email}")
  })

  it("renders entity-typed markup literally", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("renders literally: <div>.")
  })

  it("skips the empty paragraph and breaks mid-paragraph on <br>", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("above this line, and \\\\ this breaks mid-paragraph.")
  })

  it("renders signoff and signature", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).toContain("\\noindent Yours sincerely, \\\\")
    expect(tex).toContain("\\noindent Jane Doe")
  })

  it("escapes user-provided strings exactly once", () => {
    const payload: CoverLetterPayload = {
      ...basePayload,
      body: "<p>Special chars: & % $ # _ { } ~ ^ \\</p>",
    }
    const tex = squash(renderCoverLetter(payload))
    // escape-latex uses \textasciitilde{} and \textasciicircum{} for ~ and ^
    expect(tex).toContain(
      "\\& \\% \\$ \\# \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    )
  })

  it("ignores the title field", () => {
    const tex = squash(renderCoverLetter(basePayload))
    expect(tex).not.toContain("Acme Corp")
  })

  it("omits date, subject, signoff, and signature lines when null", () => {
    const payload: CoverLetterPayload = {
      contact: { full_name: "Jane Doe" },
      date: null,
      subject: null,
      body: "<p>Hello.</p>",
      signoff: null,
    }
    const tex = squash(renderCoverLetter(payload))
    expect(tex).not.toContain("2026-09-12")
    expect(tex).not.toContain("\\noindent \\textbf{")
    expect(tex).not.toContain("Yours sincerely")
    // Signature (name) also omitted when no signoff.
    expect(tex).not.toContain("\\noindent Jane Doe")
  })

  it("omits header rows when contact details are missing", () => {
    const payload: CoverLetterPayload = {
      ...basePayload,
      contact: { full_name: "Jane Smith" },
      body: "<p>Hello.</p>",
    }
    const tex = squash(renderCoverLetter(payload))
    expect(tex).not.toContain("\\texttt")
    expect(tex).not.toContain("\\href")
    expect(tex).not.toContain("\\textit")
  })
})
