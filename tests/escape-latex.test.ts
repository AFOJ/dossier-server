import { describe, it, expect } from "vitest"
import { escapeLatex } from "../src/lib/escape-latex.js"

describe("escapeLatex", () => {
  it("leaves plain text untouched", () => {
    expect(escapeLatex("Senior Software Engineer")).toBe("Senior Software Engineer")
  })

  it("escapes ampersands", () => {
    expect(escapeLatex("Apps & Integrations")).toBe("Apps \\& Integrations")
    expect(escapeLatex("Testing & Observability")).toBe("Testing \\& Observability")
  })

  it("escapes percent signs", () => {
    expect(escapeLatex("led to a 100% increase")).toBe("led to a 100\\% increase")
  })

  it("escapes hashes", () => {
    expect(escapeLatex("C# and F#")).toBe("C\\# and F\\#")
  })

  it("escapes underscores", () => {
    expect(escapeLatex("snake_case_field")).toBe("snake\\_case\\_field")
  })

  it("escapes dollar signs", () => {
    expect(escapeLatex("$100 revenue")).toBe("\\$100 revenue")
  })

  it("escapes braces", () => {
    expect(escapeLatex("{braced}")).toBe("\\{braced\\}")
  })

  it("escapes tildes", () => {
    expect(escapeLatex("approx. ~30 users")).toBe("approx. \\textasciitilde{}30 users")
  })

  it("escapes carets", () => {
    expect(escapeLatex("x^2")).toBe("x\\textasciicircum{}2")
  })

  it("escapes backslashes without double-escaping the replacement", () => {
    const result = escapeLatex("C:\\path")
    expect(result).toBe("C:\\textbackslash{}path")
    // The output must not contain escaped braces from re-scanning.
    expect(result).not.toContain("\\{")
  })

  it("handles content mixing multiple special characters", () => {
    expect(escapeLatex("Cut costs by 30% & saved $5k (Q1_2026)")).toBe(
      "Cut costs by 30\\% \\& saved \\$5k (Q1\\_2026)",
    )
  })

  it("passes through unicode punctuation untouched", () => {
    expect(escapeLatex("Dossier’s tooling · real-time")).toBe("Dossier’s tooling · real-time")
  })
})
