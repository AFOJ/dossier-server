/**
 * Converts the cover-letter rich-text HTML string (e.g. TipTap output) into
 * an array of pre-escaped LaTeX paragraph bodies.
 *
 * Supported subset (by design):
 * - `p` / `div` and other block tags delimit paragraphs
 * - `br` becomes an in-paragraph line break (`\\`)
 * - `strong` / `b` becomes `\textbf{}`
 * - `a[href]` (http/https/mailto only) becomes `\href{}{}`
 *
 * Everything else is stripped but its inner text is kept, except
 * `script` / `style` whose content is dropped entirely.
 *
 * Ordering guarantee: tag tokenization happens on the raw HTML *before*
 * entity decoding, so literal `&lt;div&gt;` typed by the user decodes to
 * text (`<div>`, LaTeX-escaped) instead of being parsed as markup.
 */

import { escapeLatex } from "./escape-latex.js"

/** In-paragraph LaTeX line break emitted for `<br>`. */
const LINE_BREAK = "\\\\"

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "li",
  "ul",
  "ol",
])

const BOLD_TAGS = new Set(["strong", "b"])

/** Tags whose *content* is dropped entirely (not just the tags). */
const SKIP_CONTENT_TAGS = new Set(["script", "style"])

const HREF_ATTR_RE = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`>]+))/i

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/** Decodes HTML entities in a text node (or attribute value). */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isSafeInteger(code) ? String.fromCodePoint(code) : match
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isSafeInteger(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

function parseHref(rawAttrs: string): string | null {
  const match = HREF_ATTR_RE.exec(rawAttrs)
  if (!match) return null
  const raw = match[2] ?? match[3] ?? match[4] ?? ""
  const href = decodeHtmlEntities(raw).trim()
  if (/^(https?:|mailto:)/i.test(href)) return href
  return null
}

function isClosingTag(token: string): boolean {
  return token.startsWith("</")
}

function tagNameOf(token: string): string {
  const match = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(token)
  return match ? match[1]!.toLowerCase() : ""
}

function isSelfClosing(token: string, name: string): boolean {
  return token.endsWith("/>") || name === "br"
}

/**
 * Converts an HTML string into LaTeX paragraph bodies. Each returned string
 * is already LaTeX-escaped (formatting commands included); the caller only
 * needs to wrap it in a SafeString. Spacing scales with break count: every
 * paragraph carries a trailing `\\[Npt]` — a base 6pt for content plus 6pt
 * per trailing `<br>`, and runs of empty paragraphs (`<p></p>`,
 * `<p>&nbsp;</p>`, `<p><br></p>`) become stacked `\\[6pt]` spacers, so each
 * one widens the gap between sections.
 */
export function convertHtmlBodyToLatex(html: string): string[] {
  const paragraphs: string[] = []
  let current = ""
  let boldDepth = 0
  const linkStack: (string | null)[] = []
  let skipDepth = 0
  let trailingBreaks = 0

  const activeHref = (): string | null => {
    for (let i = linkStack.length - 1; i >= 0; i--) {
      const href = linkStack[i]
      if (href) return href
    }
    return null
  }

  const flushParagraph = (emitEmpty = true): void => {
    // Trim stray leading/trailing breaks from e.g. `<p><br>text<br></p>`.
    let out = current.trim()
    while (out.startsWith(LINE_BREAK)) out = out.slice(LINE_BREAK.length).trimStart()

    // Count trailing breaks by removing them.
    let trailing = 0
    while (out.endsWith(LINE_BREAK)) {
      out = out.slice(0, -LINE_BREAK.length).trimEnd()
      trailing++
    }

    if (out) {
      // Content paragraph: base 6pt + 6pt per trailing break.
      out += ` \\\\[${(1 + trailing) * 6}pt]`
      paragraphs.push(out)
    } else if (emitEmpty) {
      // Empty paragraph ended by a closing tag (`<p></p>`, `<p>&nbsp;</p>`,
      // or break-only like `<p><br></p>`/`<p><br><br></p>`): vertical spacer
      // scaling with the number of breaks, at least one slot.
      const slots = Math.max(1, trailingBreaks)
      paragraphs.push(`\\\\[${slots * 6}pt]`)
    } else {
      // Start-of-block flush (an opening tag or end of document) with nothing
      // pending: not a real paragraph, emit nothing.
    }
    current = ""
    trailingBreaks = 0
  }

  const appendTextNode = (raw: string): void => {
    if (skipDepth > 0) return
    if (!raw) return
    const decoded = decodeHtmlEntities(raw)
    if (!decoded) return
    let segment = escapeLatex(decoded)
    if (boldDepth > 0) segment = `\\textbf{${segment}}`
    const href = activeHref()
    if (href) segment = `\\href{${escapeLatex(href)}}{${segment}}`
    if (segment) trailingBreaks = 0
    current += segment
  }

  const tokenRe = /<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*\/?>|<\/[a-zA-Z][a-zA-Z0-9]*\s*>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(html)) !== null) {
    appendTextNode(html.slice(lastIndex, match.index))
    lastIndex = match.index + match[0].length
    const token = match[0]
    if (token.startsWith("<!--")) continue

    const closing = isClosingTag(token)
    const name = tagNameOf(token)
    if (!name) continue

    if (SKIP_CONTENT_TAGS.has(name)) {
      if (!closing && !isSelfClosing(token, name)) skipDepth++
      else if (closing && skipDepth > 0) skipDepth--
      continue
    }
    if (skipDepth > 0) continue

    if (name === "br") {
      current += ` ${LINE_BREAK} `
      trailingBreaks++
      continue
    }

    if (BLOCK_TAGS.has(name)) {
      // Closing a block finalizes its paragraph (including an empty one,
      // which becomes a spacer); opening one only finalizes whatever is left
      // over from an unclosed predecessor, never a bare spacer.
      flushParagraph(closing)
      continue
    }

    if (BOLD_TAGS.has(name)) {
      if (!closing && !isSelfClosing(token, name)) boldDepth++
      else if (closing && boldDepth > 0) boldDepth--
      continue
    }

    if (name === "a") {
      if (!closing && !isSelfClosing(token, name)) {
        const attrs = token.replace(/^<a\b/i, "").replace(/\/?>$/, "")
        linkStack.push(parseHref(attrs))
      } else if (closing && linkStack.length > 0) {
        linkStack.pop()
      }
      continue
    }

    // All other tags (u, em, i, span, ...): stripped, inner text kept.
  }
  appendTextNode(html.slice(lastIndex))
  flushParagraph(false)

  return paragraphs
}
