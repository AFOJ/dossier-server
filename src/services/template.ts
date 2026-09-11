/**
 * Renders a resume payload into a complete LaTeX document.
 *
 * Templates live in src/templates and are copied to dist/templates by the
 * build script; this module resolves them relative to its own location so
 * it works in both dev (src) and compiled (dist) layouts.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Handlebars from "handlebars"

import type { ResumePayload } from "../schemas/resume.js"
import type { CoverLetterPayload } from "../schemas/cover-letter.js"
import { buildViewModel, buildCoverLetterViewModel } from "./template-model.js"

const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates")

let compiledTemplate: HandlebarsTemplateDelegate | null = null

function compileTemplate(): HandlebarsTemplateDelegate {
  const partialsDir = path.join(templatesDir, "partials")
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".hbs")) continue
    const name = path.basename(file, ".hbs")
    Handlebars.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), "utf8"))
  }

  // Maps a section's `type` to the matching registered partial.
  Handlebars.registerHelper("sectionPartial", (type: unknown) => {
    return new Handlebars.SafeString(String(type))
  })

  // Handlebars core does not provide boolean helpers.
  Handlebars.registerHelper("or", (...args: unknown[]) => {
    args.pop() // drop the options hash
    return args.some(Boolean)
  })

  const source = fs.readFileSync(path.join(templatesDir, "resume.hbs"), "utf8")
  return Handlebars.compile(source)
}

export function renderResume(payload: ResumePayload): string {
  compiledTemplate ??= compileTemplate()
  return compiledTemplate(buildViewModel(payload))
}

let compiledCoverLetterTemplate: HandlebarsTemplateDelegate | null = null

function compileCoverLetterTemplate(): HandlebarsTemplateDelegate {
  const partialsDir = path.join(templatesDir, "partials")
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".hbs")) continue
    const name = path.basename(file, ".hbs")
    Handlebars.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), "utf8"))
  }

  Handlebars.registerHelper("or", (...args: unknown[]) => {
    args.pop()
    return args.some(Boolean)
  })

  const source = fs.readFileSync(path.join(templatesDir, "cover-letter.hbs"), "utf8")
  return Handlebars.compile(source)
}

export function renderCoverLetter(payload: CoverLetterPayload): string {
  compiledCoverLetterTemplate ??= compileCoverLetterTemplate()
  return compiledCoverLetterTemplate(buildCoverLetterViewModel(payload))
}
