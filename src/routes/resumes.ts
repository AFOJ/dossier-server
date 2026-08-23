import type { FastifyInstance } from "fastify"
import { resumePayloadSchema, type ResumePayload } from "../schemas/resume.js"
import { renderResume } from "../services/template.js"
import { compileLatex } from "../services/latex.js"

export default async function resumeRoutes(app: FastifyInstance) {
  app.post(
    "/process",
    {
      schema: {
        body: resumePayloadSchema,
      },
    },
    async (request, reply) => {
      const payload = request.body as ResumePayload

      const latex = renderResume(payload)
      const pdf = await compileLatex(latex)

      reply
        .header("Content-Disposition", 'inline; filename="resume.pdf"')
        .type("application/pdf")
        .send(pdf)
    },
  )
}
