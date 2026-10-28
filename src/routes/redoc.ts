import type { FastifyInstance } from "fastify"
import { resumePayloadSchema } from "../schemas/resume.js"
import { coverLetterPayloadSchema } from "../schemas/cover-letter.js"

type JsonSchema = Record<string, unknown>

interface OpenApiSpec {
  openapi: string
  info: { title: string }
  components: { schemas: Record<string, JsonSchema> }
  paths: Record<string, { [method: string]: JsonSchema }>
}

function extractDefinitions(schema: JsonSchema): Record<string, JsonSchema> {
  const defs: Record<string, JsonSchema> = {}
  if (schema.definitions) {
    Object.assign(defs, schema.definitions as Record<string, JsonSchema>)
  }
  function traverse(obj: JsonSchema): void {
    if (!obj || typeof obj !== "object") {
      return
    }
    if (obj.definitions) {
      Object.assign(defs, obj.definitions as Record<string, JsonSchema>)
    }
    for (const key of Object.keys(obj)) {
      if (key !== "definitions") {
        const value = obj[key]
        if (value && typeof value === "object") {
          traverse(value as JsonSchema)
        }
      }
    }
  }
  traverse(schema)
  return defs
}

function rewriteRefsDeep(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(rewriteRefsDeep)
  }
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "$ref" && typeof value === "string" && value.startsWith("#/definitions/")) {
      result[key] = value.replace("#/definitions/", "#/components/schemas/")
    } else {
      result[key] = rewriteRefsDeep(value)
    }
  }
  return result
}

function rewriteRefsInDefinitions(defs: Record<string, JsonSchema>): Record<string, JsonSchema> {
  const result: Record<string, JsonSchema> = {}
  for (const [key, schema] of Object.entries(defs)) {
    result[key] = rewriteRefsDeep(schema) as JsonSchema
  }
  return result
}

function stripMeta(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") {
    return schema
  }
  if (Array.isArray(schema)) {
    return schema.map(stripMeta)
  }
  const {
    $id: _id,
    $schema: _schema,
    definitions: _definitions,
    ...rest
  } = schema as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    result[key] = stripMeta(value)
  }
  return result
}

/**
 * Renames a definition key (and every `$ref` pointing at it) so two schemas
 * can share the component map without clashing, e.g. the resume's `contact`
 * (with links) vs. the cover letter's `contact` (no links).
 */
function renameDefinition(
  schema: JsonSchema,
  from: string,
  to: string,
  refPrefix = "#/definitions/",
): JsonSchema {
  const rename = (obj: unknown): unknown => {
    if (!obj || typeof obj !== "object") {
      return obj
    }
    if (Array.isArray(obj)) {
      return obj.map(rename)
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "$ref" && value === `${refPrefix}${from}`) {
        result[key] = `${refPrefix}${to}`
      } else if (key === "definitions") {
        const defs: Record<string, unknown> = {}
        for (const [defKey, defValue] of Object.entries(value as Record<string, unknown>)) {
          defs[defKey === from ? to : defKey] = rename(defValue)
        }
        result[key] = defs
      } else {
        result[key] = rename(value)
      }
    }
    return result
  }
  return rename(schema) as JsonSchema
}

const EXAMPLE_RESUME = {
  title: "Senior Software Engineer",
  contact: {
    full_name: "Jane Smith",
    role: "Senior Software Engineer",
    email: "jane.smith@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    links: [
      { label: "GitHub", url: "https://github.com/janesmith" },
      { label: "LinkedIn", url: "https://linkedin.com/in/janesmith" },
      { label: "Portfolio", url: "https://janesmith.dev" },
    ],
  },
  sections: [
    {
      type: "paragraph",
      title: "Profile",
      text: "Senior software engineer with 8+ years of experience building scalable web applications and distributed systems. Passionate about clean architecture, developer experience, and mentoring junior engineers.",
    },
    {
      type: "experience",
      title: "Experience",
      companies: [
        {
          company_name: "TechCorp Inc.",
          company_website: "https://techcorp.example.com",
          start_date: "2021-03",
          end_date: null,
          roles: [
            {
              job_title: "Senior Software Engineer",
              employment_type: "Full-time",
              location: "San Francisco, CA (Remote)",
              start_date: "2021-03",
              end_date: "2024-01",
              bullets: [
                {
                  type: "text",
                  text: "Led migration of monolithic Rails app to TypeScript/Node.js microservices, reducing deployment time by 80%.",
                },
                {
                  type: "text-with-title",
                  title: "Impact",
                  text: "Reduced infrastructure costs by $120k/year through containerization and auto-scaling.",
                },
              ],
            },
          ],
        },
        {
          company_name: "StartupXYZ",
          company_website: "https://startupxyz.example.com",
          start_date: "2018-06",
          end_date: "2021-02",
          roles: [
            {
              job_title: "Software Engineer",
              employment_type: "Full-time",
              location: "Austin, TX",
              start_date: "2018-06",
              end_date: "2021-02",
              bullets: [
                {
                  type: "text",
                  text: "Built real-time collaboration features using WebSockets and Redis, supporting 10k+ concurrent users.",
                },
                {
                  type: "text-with-title",
                  title: "Achievement",
                  text: "Implemented CI/CD pipeline reducing release cycle from weekly to daily.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "skills",
      title: "Skills",
      groups: [
        { title: "Languages", items: ["TypeScript", "Python", "Go", "SQL"] },
        { title: "Frameworks", items: ["React", "Node.js", "Express", "Next.js"] },
        { title: "Infrastructure", items: ["Docker", "Kubernetes", "AWS", "Terraform"] },
        { title: "Databases", items: ["PostgreSQL", "Redis", "MongoDB"] },
      ],
    },
    {
      type: "education",
      title: "Education",
      institutions: [
        {
          name: "Stanford University",
          degree: "M.S. Computer Science",
          grade: "3.9/4.0",
          start_date: "2016-09",
          end_date: "2018-06",
          location: "Stanford, CA",
          paragraph:
            "Specialized in Distributed Systems and Machine Learning. Thesis: 'Optimizing Consensus Algorithms for Geo-Distributed Databases'.",
        },
        {
          name: "University of Texas at Austin",
          degree: "B.S. Computer Science",
          grade: "3.7/4.0",
          start_date: "2012-09",
          end_date: "2016-05",
          location: "Austin, TX",
        },
      ],
    },
    {
      type: "projects",
      title: "Projects",
      projects: [
        {
          name: "Flux Design System",
          url: "https://github.com/AFOJ/flux-design-system",
          technologies: ["TypeScript", "React", "Storybook", "Figma API"],
          start_date: "2025",
          end_date: "2026",
          bullets: [
            {
              type: "text",
              text: "Built a multi-theme design system with an automated Figma-to-CSS token pipeline.",
            },
            {
              type: "text-with-title",
              title: "Accessibility",
              text: "Shipped an accessibility-first Storybook component library adopted across four product teams.",
            },
          ],
        },
        {
          name: "Ask Airspeed",
          url: "https://github.com/AFOJ/ask-airspeed",
          technologies: ["TypeScript", "Next.js", "OpenAI"],
          start_date: "2026",
          bullets: [
            {
              type: "text",
              text: "Built a natural language interface for querying sales call history with intent-driven API orchestration.",
            },
          ],
        },
      ],
    },
    {
      type: "list",
      title: "Talks",
      items: [
        {
          title: "Next i18n: Performant, Rich Translations in Next.js",
          url: "https://youtu.be/tq9MfIG-VXw?t=14526",
          description: "JS@PayPal Worldwide Virtual Conference",
          date: "2021",
        },
        {
          title: "A QuickStart™ Guide to Making Things on the Internet",
          url: "https://www.youtube.com/watch?v=6EHbfAmA_0c",
          description: "Google Women Techmakers Montreal",
          date: "2016",
        },
      ],
    },
  ],
}

const EXAMPLE_COVER_LETTER: Record<string, unknown> = {
  title: "Chef Cover",
  contact: {
    full_name: "Alex Moreau",
    role: "Head Chef",
    email: "alex@example.com",
    phone: "+45 555 0142",
    location: "Copenhagen, DK",
  },
  date: "September 11, 2026",
  subject: "Re: Head Chef Position at Restaurant Noma",
  // The signoff is part of the body: users write it themselves, so there is
  // no separate signoff field.
  body: "<p>Dear Hiring Manager,</p><p>I am writing to express my interest in the <strong>Head Chef</strong> position at Restaurant Noma. With 11 years of experience across Michelin-starred kitchens, I am confident I can contribute to your brigade's continued excellence.</p><p>I would welcome the opportunity to discuss how my background aligns with Noma's vision. Thank you for your time and consideration.<br><br>Sincerely,<br>Alex Moreau</p>",
}

function buildOpenApiSpec(): OpenApiSpec {
  // The cover letter reuses a contact shape without `links`; give it its own
  // component name so it doesn't collide with the resume's richer contact.
  const coverLetterSchema = renameDefinition(
    coverLetterPayloadSchema as JsonSchema,
    "contact",
    "coverLetterContact",
  )

  return {
    openapi: "3.1.0",
    info: { title: "Dossier API" },
    components: {
      schemas: {
        ...rewriteRefsInDefinitions(extractDefinitions(coverLetterSchema)),
        ...rewriteRefsInDefinitions(extractDefinitions(resumePayloadSchema as JsonSchema)),
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          tags: ["health"],
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { status: { type: "string" } } },
                },
              },
            },
          },
        },
      },
      "/api/resumes/process": {
        post: {
          summary: "Generate resume PDF",
          tags: ["resume"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  ...(stripMeta(rewriteRefsDeep(resumePayloadSchema as JsonSchema)) as Record<
                    string,
                    unknown
                  >),
                  example: EXAMPLE_RESUME,
                } as Record<string, unknown>,
              },
            },
          },
          responses: {
            200: {
              description: "PDF generated",
              content: {
                "application/pdf": {},
              },
            },
          },
        },
      },
      "/api/cover-letters/process": {
        post: {
          summary: "Generate cover letter PDF",
          tags: ["cover-letter"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  ...(stripMeta(rewriteRefsDeep(coverLetterSchema)) as Record<string, unknown>),
                  example: EXAMPLE_COVER_LETTER,
                } as Record<string, unknown>,
              },
            },
          },
          responses: {
            200: {
              description: "PDF generated",
              content: {
                "application/pdf": {},
              },
            },
          },
        },
      },
    },
  }
}

const SWAGGER_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Dossier API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://res.cloudinary.com/xhbqeqrl/image/upload/v1788437708/dossier-api-favicon.jpg" />
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style> body { margin: 0; padding: 0; } </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/docs/json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.presets.standalone
        ],
        layout: 'BaseLayout',
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: false,
        supportedSubmitMethods: []
      });
    };
  </script>
</body>
</html>`

export default async function docsRoutes(app: FastifyInstance) {
  const spec = buildOpenApiSpec()

  app.get("/", async (_request, reply) => {
    return reply.redirect("/docs")
  })

  app.get("/docs", async (_request, reply) => {
    return reply.type("text/html").send(SWAGGER_HTML)
  })

  app.get("/docs/json", async () => spec)
}
