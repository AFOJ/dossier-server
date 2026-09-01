/**
 * Escapes characters that have special meaning in LaTeX so user-provided
 * text compiles instead of breaking the document.
 *
 * A single regex pass guarantees replacement output is never re-scanned,
 * so e.g. an escaped brace inside `\textbackslash{}` stays intact.
 */

const ESCAPE_MAP: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
}

const SPECIAL_CHARS = Object.keys(ESCAPE_MAP)
  .map((char) => char.replace(/[\\\]^-]/g, "\\$&"))
  .join("")

const SPECIAL_RE = new RegExp(`[${SPECIAL_CHARS}]`, "g")

export function escapeLatex(input: string): string {
  return input.replace(SPECIAL_RE, (char) => ESCAPE_MAP[char] ?? char)
}
