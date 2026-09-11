import type { FastifyInstance } from "fastify"
import { coverLetterPayloadSchema, type CoverLetterPayload } from "../schemas/cover-letter.js"
import { renderCoverLetter } from "../services/template.js"
import { compileLatex } from "../services/latex.js"

export default async function coverLetterRoutes(app: FastifyInstance) {
  app.post(
    "/process",
    {
      schema: {
        body: coverLetterPayloadSchema,
      },
    },
    async (request, reply) => {
      const payload = request.body as CoverLetterPayload

      const latex = renderCoverLetter(payload)
      const pdf = await compileLatex(latex)

      reply
        .header("Content-Disposition", 'inline; filename="cover-letter.pdf"')
        .type("application/pdf")
        .send(pdf)
    },
  )
}
