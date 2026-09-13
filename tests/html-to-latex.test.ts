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
    expect(convertHtmlBodyToLatex("<p>One.</p><p>Two.</p>")).toEqual(["One.", "Two."])
  })

  it("converts <br> to an in-paragraph line break", () => {
    const [para] = convertHtmlBodyToLatex("<p>first<br>second</p>")
    expect(para).toContain("first \\\\ second")
  })

  it("converts strong/b to \\textbf", () => {
    expect(convertHtmlBodyToLatex("<p>a <strong>bold</strong> word</p>")).toEqual([
      "a \\textbf{bold} word",
    ])
    expect(convertHtmlBodyToLatex("<p>a <b>bold</b> word</p>")).toEqual(["a \\textbf{bold} word"])
  })

  it("converts links to \\href", () => {
    expect(convertHtmlBodyToLatex('<p>see <a href="https://example.com">this</a></p>')).toEqual([
      "see \\href{https://example.com}{this}",
    ])
  })

  it("nests bold inside links", () => {
    expect(
      convertHtmlBodyToLatex(
        '<p><a href="https://github.com/janedoe"><strong>my GitHub</strong></a></p>',
      ),
    ).toEqual(["\\href{https://github.com/janedoe}{\\textbf{my GitHub}}"])
  })

  it("decodes entities in link urls", () => {
    expect(
      convertHtmlBodyToLatex(
        '<p><a href="https://example.com/case-study?ref=letter&amp;utm=1">pipeline</a></p>',
      ),
    ).toEqual(["\\href{https://example.com/case-study?ref=letter\\&utm=1}{pipeline}"])
  })

  it("renders entity-typed markup literally instead of parsing it", () => {
    expect(convertHtmlBodyToLatex("<p>Markup renders literally: &lt;div&gt;.</p>")).toEqual([
      "Markup renders literally: <div>.",
    ])
  })

  it("strips unsupported tags but keeps their text", () => {
    expect(convertHtmlBodyToLatex("<p>with <u>payments experience</u> here</p>")).toEqual([
      "with payments experience here",
    ])
  })

  it("drops script/style content entirely", () => {
    expect(convertHtmlBodyToLatex("<p>Hi<script>alert(1)</script> there</p>")).toEqual(["Hi there"])
  })

  it("degrades non-http links to plain text", () => {
    expect(convertHtmlBodyToLatex('<p><a href="javascript:alert(1)">click</a></p>')).toEqual([
      "click",
    ])
  })

  it("skips empty paragraphs such as <p><br></p>", () => {
    expect(convertHtmlBodyToLatex("<p><br></p><p>Real.</p>")).toEqual(["Real."])
  })

  it("escapes LaTeX special chars in text", () => {
    expect(convertHtmlBodyToLatex("<p>100% & R&D costs $5_000</p>")).toEqual([
      "100\\% \\& R\\&D costs \\$5\\_000",
    ])
  })

  it("preserves unicode as-is", () => {
    expect(convertHtmlBodyToLatex("<p>naïve façade, 日本語テスト, 🎉</p>")).toEqual([
      "naïve façade, 日本語テスト, 🎉",
    ])
  })
})
