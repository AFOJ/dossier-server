import type { FastifyInstance } from "fastify"
import { resumePayloadSchema } from "../schemas/resume.js"

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
      type: "list",
      title: "Projects",
      items: [
        {
          title: "Flux Design System",
          url: "https://github.com/AFOJ/flux-design-system",
          description:
            "Multi-theme design system with automated Figma-to-CSS token pipeline and accessibility-first Storybook component library.",
          date: "2026",
        },
        {
          title: "Ask Airspeed",
          url: "https://github.com/AFOJ/ask-airspeed",
          description:
            "Natural language interface for querying sales call history with intent-driven API orchestration.",
          date: "2026",
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

function buildOpenApiSpec(): OpenApiSpec {
  return {
    openapi: "3.1.0",
    info: { title: "Dossier API" },
    components: {
      schemas: rewriteRefsInDefinitions(extractDefinitions(resumePayloadSchema as JsonSchema)),
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
