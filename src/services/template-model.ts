/**
 * Builds the view model consumed by the Handlebars templates.
 * Every user string is LaTeX-escaped exactly once here, then wrapped in a
 * SafeString so templates can interpolate with plain double-stash. Fields
 * ending in `Arg` are macro arguments and include their own braces.
 */

import { SafeString } from "handlebars"

import { formatDateRange, isPresent } from "../lib/dates.js"
import { escapeLatex } from "../lib/escape-latex.js"
import type { Bullet, Contact, ResumePayload, Section } from "../schemas/resume.js"

/** A chunk of trusted, pre-escaped LaTeX. */
export type Tex = SafeString

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

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

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

export type SectionViewModel =
  | ParagraphSectionViewModel
  | EducationSectionViewModel
  | SkillsSectionViewModel
  | ExperienceSectionViewModel

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
  }
}

// ---------------------------------------------------------------------------
// Root view model
// ---------------------------------------------------------------------------

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
