import { describe, it, expect } from "vitest"
import { convertHtmlBodyToLatex, decodeHtmlEntities } from "../src/lib/html-to-latex.js"

describe("decodeHtmlEntities", () => {
  it("decodes named entities", () => {
    expect(decodeHtmlEntities("parsers &amp; pretty-printers")).toBe("parsers & pretty-printers")
    expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>")
    expect(decodeHtmlEntities("non-breaking&nbsp;spaces")).toBe("non-breaking spaces")
    expect(decodeHtmlEntities("&quot;printf&quot;")).toBe('"printf"')
  })

  it("decodes numeric entities", () => {
    expect(decodeHtmlEntities("&#65;")).toBe("A")
    expect(decodeHtmlEntities("&#x1F389;")).toBe("🎉")
  })

  it("leaves unknown entities untouched", () => {
    expect(decodeHtmlEntities("&bogus;")).toBe("&bogus;")
  })
})

describe("convertHtmlBodyToLatex", () => {
  it("splits paragraphs on <p> tags", () => {
    expect(convertHtmlBodyToLatex("<p>One.</p><p>Two.</p>")).toEqual([
      "One. \\\\[6pt]",
      "Two. \\\\[6pt]",
    ])
  })

  it("converts <br> to an in-paragraph line break", () => {
    const [para] = convertHtmlBodyToLatex("<p>first<br>second</p>")
    expect(para).toContain("first \\\\ second")
    expect(para).toContain("\\\\[6pt]")
  })

  it("converts strong/b to \\textbf", () => {
    expect(convertHtmlBodyToLatex("<p>a <strong>bold</strong> word</p>")).toEqual([
      "a \\textbf{bold} word \\\\[6pt]",
    ])
    expect(convertHtmlBodyToLatex("<p>a <b>bold</b> word</p>")).toEqual([
      "a \\textbf{bold} word \\\\[6pt]",
    ])
  })

  it("converts links to \\href", () => {
    expect(convertHtmlBodyToLatex('<p>see <a href="https://example.com">this</a></p>')).toEqual([
      "see \\href{https://example.com}{this} \\\\[6pt]",
    ])
  })

  it("nests bold inside links", () => {
    expect(
      convertHtmlBodyToLatex(
        '<p><a href="https://github.com/janedoe"><strong>my GitHub</strong></a></p>',
      ),
    ).toEqual(["\\href{https://github.com/janedoe}{\\textbf{my GitHub}} \\\\[6pt]"])
  })

  it("decodes entities in link urls", () => {
    expect(
      convertHtmlBodyToLatex(
        '<p><a href="https://example.com/case-study?ref=letter&utm=1">pipeline</a></p>',
      ),
    ).toEqual(["\\href{https://example.com/case-study?ref=letter\\&utm=1}{pipeline} \\\\[6pt]"])
  })

  it("renders entity-typed markup literally instead of parsing it", () => {
    expect(convertHtmlBodyToLatex("<p>Markup renders literally: &lt;div&gt;.</p>")).toEqual([
      "Markup renders literally: <div>. \\\\[6pt]",
    ])
  })

  it("strips unsupported tags but keeps their text", () => {
    expect(convertHtmlBodyToLatex("<p>with <u>payments experience</u> here</p>")).toEqual([
      "with payments experience here \\\\[6pt]",
    ])
  })

  it("drops script/style content entirely", () => {
    expect(convertHtmlBodyToLatex("<p>Hi<script>alert(1)</script> there</p>")).toEqual([
      "Hi there \\\\[6pt]",
    ])
  })

  it("degrades non-http links to plain text", () => {
    expect(convertHtmlBodyToLatex('<p><a href="javascript:alert(1)">click</a></p>')).toEqual([
      "click \\\\[6pt]",
    ])
  })

  it("converts break-only paragraph with single <br> to vertical space", () => {
    expect(convertHtmlBodyToLatex("<p><br></p><p>Real.</p>")).toEqual([
      "\\\\[6pt]",
      "Real. \\\\[6pt]",
    ])
  })

  it("converts break-only paragraph with multiple <br> to vertical space", () => {
    const [para] = convertHtmlBodyToLatex("<p><br><br></p>")
    expect(para).toBe("\\\\[12pt]")
  })

  it("converts break-only paragraph with 4 <br> to vertical space", () => {
    const [para] = convertHtmlBodyToLatex("<p><br><br><br><br></p>")
    expect(para).toBe("\\\\[24pt]")
  })

  it("treats empty <p></p> as 6pt vertical space", () => {
    expect(convertHtmlBodyToLatex("<p>One.</p><p></p><p>Two.</p>")).toEqual([
      "One. \\\\[6pt]",
      "\\\\[6pt]",
      "Two. \\\\[6pt]",
    ])
  })

  it("treats nbsp-only <p>&nbsp;</p> as 6pt vertical space", () => {
    expect(convertHtmlBodyToLatex("<p>One.</p><p>&nbsp;</p><p>Two.</p>")).toEqual([
      "One. \\\\[6pt]",
      "\\\\[6pt]",
      "Two. \\\\[6pt]",
    ])
  })

  it("stacks consecutive empty paragraphs into a larger gap", () => {
    expect(convertHtmlBodyToLatex("<p>One.</p><p></p><p></p><p></p><p></p><p>Two.</p>")).toEqual([
      "One. \\\\[6pt]",
      "\\\\[6pt]",
      "\\\\[6pt]",
      "\\\\[6pt]",
      "\\\\[6pt]",
      "Two. \\\\[6pt]",
    ])
  })

  it("adds a slot for a single trailing <br> on content paragraphs", () => {
    const [para] = convertHtmlBodyToLatex("<p>Hello<br></p>")
    expect(para).toBe("Hello \\\\[12pt]")
  })

  it("escapes LaTeX special chars in text", () => {
    expect(convertHtmlBodyToLatex("<p>100% & R&D costs $5_000</p>")).toEqual([
      "100\\% \\& R\\&D costs \\$5\\_000 \\\\[6pt]",
    ])
  })

  it("preserves multiple trailing <br> as extra vertical space", () => {
    const [para] = convertHtmlBodyToLatex("<p>Hello<br><br></p>")
    expect(para).toContain("\\\\[18pt]")
  })

  it("preserves three trailing <br> as more vertical space", () => {
    const [para] = convertHtmlBodyToLatex("<p>Hello<br><br><br></p>")
    expect(para).toContain("\\\\[24pt]")
  })

  it("preserves mid-paragraph <br> as line breaks", () => {
    const [para] = convertHtmlBodyToLatex("<p>Line1<br>Line2</p>")
    expect(para).toContain("Line1 \\\\ Line2")
    expect(para).toContain("\\\\[6pt]")
  })

  it("handles mixed: mid-paragraph breaks + trailing breaks", () => {
    const [para] = convertHtmlBodyToLatex("<p>Line1<br>Line2<br><br></p>")
    expect(para).toContain("Line1 \\\\ Line2")
    expect(para).toContain("\\\\[18pt]")
  })

  it("preserves unicode as-is", () => {
    expect(convertHtmlBodyToLatex("<p>naïve façade, 日本語テスト, 🎉</p>")).toEqual([
      "naïve façade, 日本語テスト, 🎉 \\\\[6pt]",
    ])
  })
})
