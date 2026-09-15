/**
 * Builds the view model consumed by the Handlebars templates.
 * Every user string is LaTeX-escaped exactly once here, then wrapped in a
 * SafeString so templates can interpolate with plain double-stash. Fields
 * ending in `Arg` are macro arguments and include their own braces.
 */

import Handlebars from "handlebars"

import { formatDateRange, isPresent } from "../lib/dates.js"
import { escapeLatex } from "../lib/escape-latex.js"
import { convertHtmlBodyToLatex } from "../lib/html-to-latex.js"
import type { Bullet, Contact, ResumePayload, Section } from "../schemas/resume.js"
import type { CoverLetterPayload } from "../schemas/cover-letter.js"

// handlebars is CommonJS; named imports of its exports fail in Node ESM.
const { SafeString } = Handlebars

/** A chunk of trusted, pre-escaped LaTeX. */
export type Tex = InstanceType<typeof SafeString>

const SEP = " · "

function tex(value: string): Tex {
  return new SafeString(value)
}

function arg(value: string): Tex {
  return tex(`{${escapeLatex(value)}}`)
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export interface HeaderViewModel {
  nameLine: Tex
  contactLine?: Tex
  linksLine?: Tex
  roleArg?: Tex
  locationArg?: Tex
}

export function buildHeader(contact: Contact): HeaderViewModel {
  const contacts: string[] = []
  if (contact.email) {
    const email = escapeLatex(contact.email)
    contacts.push(`\\texttt{\\href{mailto:${email}}{${email}}}`)
  }
  if (contact.phone) {
    contacts.push(`\\texttt{${escapeLatex(contact.phone)}}`)
  }

  const links = (contact.links ?? []).map(
    (link) => `\\href{${escapeLatex(link.url)}}{${escapeLatex(link.label)}}`,
  )

  return {
    // Composed here: a mustache next to a literal LaTeX brace is
    // unparseable by Handlebars, so brace-heavy lines live in TS.
    nameLine: tex(`\\textbf{\\LARGE {${escapeLatex(contact.full_name)}}}`),
    ...(contacts.length > 0 ? { contactLine: tex(contacts.join(SEP)) } : {}),
    ...(links.length > 0 ? { linksLine: tex(links.join(SEP)) } : {}),
    ...(contact.role ? { roleArg: arg(contact.role) } : {}),
    ...(contact.location ? { locationArg: arg(contact.location) } : {}),
  }
}

export interface ParagraphSectionViewModel {
  type: "paragraph"
  titleArg: Tex
  textArg: Tex
}

export interface EducationInstitutionViewModel {
  nameArg: Tex
  datesArg: Tex
  degreeArg: Tex
  locationArg: Tex
  paragraphArg?: Tex
}

export interface EducationSectionViewModel {
  type: "education"
  titleArg: Tex
  institutions: EducationInstitutionViewModel[]
}

export interface SkillGroupViewModel {
  titleArg: Tex
  itemsArg: Tex
}

export interface SkillsSectionViewModel {
  type: "skills"
  titleArg: Tex
  groups: SkillGroupViewModel[]
}

export interface ExperienceBulletViewModel {
  titleArg?: Tex
  textArg: Tex
}

export interface ExperienceRoleViewModel {
  roleLineArg: Tex
  datesArg: Tex
  bullets: ExperienceBulletViewModel[]
}

export interface ExperienceCompanyViewModel {
  websiteArg?: Tex
  nameArg: Tex
  datesArg: Tex
  roles: ExperienceRoleViewModel[]
}

export interface ExperienceSectionViewModel {
  type: "experience"
  titleArg: Tex
  companies: ExperienceCompanyViewModel[]
}

export interface ListItemViewModel {
  titleArg?: Tex
  titleUrlArg?: Tex
  descriptionArg: Tex
  dateArg?: Tex
}

export interface ListSectionViewModel {
  type: "list"
  titleArg: Tex
  items: ListItemViewModel[]
}

export type SectionViewModel =
  | ParagraphSectionViewModel
  | EducationSectionViewModel
  | SkillsSectionViewModel
  | ExperienceSectionViewModel
  | ListSectionViewModel

function buildBullet(bullet: Bullet): ExperienceBulletViewModel {
  if (bullet.type === "text-with-title") {
    return { titleArg: arg(bullet.title), textArg: arg(bullet.text) }
  }
  return { textArg: arg(bullet.text) }
}

/** Composes "Senior Engineer (Full-time, Remote)", omitting missing parts. */
function composeRoleLine(role: {
  job_title: string
  employment_type?: string
  location?: string
}): string {
  const details = [role.employment_type, role.location].filter(isPresent).join(", ")
  return details ? `${role.job_title} (${details})` : role.job_title
}

function buildSection(section: Section): SectionViewModel {
  switch (section.type) {
    case "paragraph":
      return {
        type: "paragraph",
        titleArg: arg(section.title),
        textArg: arg(section.text),
      }

    case "education":
      return {
        type: "education",
        titleArg: arg(section.title),
        institutions: section.institutions.map((institution) => ({
          nameArg: arg(institution.name),
          datesArg: arg(formatDateRange(institution.start_date, institution.end_date)),
          degreeArg: arg(
            institution.grade ? `${institution.degree} (${institution.grade})` : institution.degree,
          ),
          locationArg: arg(institution.location ?? ""),
          ...(institution.paragraph ? { paragraphArg: arg(institution.paragraph) } : {}),
        })),
      }

    case "skills":
      return {
        type: "skills",
        titleArg: arg(section.title),
        groups: section.groups.map((group) => ({
          titleArg: arg(group.title),
          itemsArg: arg(group.items.join(", ")),
        })),
      }

    case "experience":
      return {
        type: "experience",
        titleArg: arg(section.title),
        companies: section.companies.map((company) => ({
          ...(company.company_website ? { websiteArg: arg(company.company_website) } : {}),
          nameArg: arg(company.company_name),
          datesArg: arg(formatDateRange(company.start_date, company.end_date)),
          roles: company.roles.map((role) => ({
            roleLineArg: arg(composeRoleLine(role)),
            datesArg: arg(formatDateRange(role.start_date, role.end_date)),
            bullets: role.bullets.map(buildBullet),
          })),
        })),
      }

    case "list":
      return {
        type: "list",
        titleArg: arg(section.title),
        items: section.items.map((item) => {
          const descWithDate = item.date ? `${item.description} (${item.date})` : item.description
          return {
            ...(item.title
              ? {
                  titleArg: arg(item.title),
                  ...(item.url ? { titleUrlArg: arg(item.url) } : {}),
                }
              : item.url
                ? { titleArg: arg(item.url), titleUrlArg: arg(item.url) }
                : {}),
            descriptionArg: arg(descWithDate),
          }
        }),
      }
  }
}

export interface ResumeViewModel {
  header: HeaderViewModel
  sections: SectionViewModel[]
}

export function buildViewModel(payload: ResumePayload): ResumeViewModel {
  return {
    header: buildHeader(payload.contact),
    sections: payload.sections.map(buildSection),
  }
}

// ---------------------------------------------------------------------------
// Cover Letter
// ---------------------------------------------------------------------------

export interface CoverHeaderRow {
  left?: Tex
  right?: Tex
}

export interface CoverLetterViewModel {
  headerRows: CoverHeaderRow[]
  dateLine?: Tex
  subjectLine?: Tex
  bodyParagraphs: Tex[]
  signoffLine?: Tex
  signatureLine?: Tex
}

export function buildCoverLetterViewModel(payload: CoverLetterPayload): CoverLetterViewModel {
  const { contact } = payload
  // Left column: name with role under. Right column: contact with location.
  // Mirrors the resume header's two-column tabular* layout. Rows are zipped
  // so neither column has middle gaps when fields are missing.
  const leftLines: Tex[] = [tex(`\\textbf{\\LARGE {${escapeLatex(contact.full_name)}}}`)]
  if (isPresent(contact.role)) leftLines.push(tex(`\\textit{${escapeLatex(contact.role!)}}`))

  const rightLines: Tex[] = []
  if (isPresent(contact.email)) {
    const email = escapeLatex(contact.email!)
    rightLines.push(tex(`\\texttt{\\href{mailto:${email}}{${email}}}`))
  }
  if (isPresent(contact.phone)) rightLines.push(tex(`\\texttt{${escapeLatex(contact.phone!)}}`))
  if (isPresent(contact.location))
    rightLines.push(tex(`\\texttt{${escapeLatex(contact.location!)}}`))

  const headerRows: CoverHeaderRow[] = []
  for (let i = 0; i < Math.max(leftLines.length, rightLines.length); i++) {
    const left = leftLines[i]
    const right = rightLines[i]
    const row: CoverHeaderRow = {}
    if (left) row.left = left
    if (right) row.right = right
    headerRows.push(row)
  }

  return {
    headerRows,
    ...(isPresent(payload.date) ? { dateLine: tex(escapeLatex(payload.date!)) } : {}),
    ...(isPresent(payload.subject)
      ? { subjectLine: tex(`\\textbf{${escapeLatex(payload.subject!)}}`) }
      : {}),
    bodyParagraphs: convertHtmlBodyToLatex(payload.body).map((p) => tex(p)),
    ...(isPresent(payload.signoff)
      ? {
          signoffLine: tex(escapeLatex(payload.signoff!)),
          signatureLine: tex(escapeLatex(payload.contact.full_name)),
        }
      : {}),
  }
}
