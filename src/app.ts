import Fastify from "fastify"
import { healthRoutes, resumeRoutes, coverLetterRoutes } from "./routes/index.js"
import { registerErrorHandlers } from "./plugins/error-handler.js"
import { registerCors } from "./plugins/cors.js"
import docsRoutes from "./routes/redoc.js"

export async function buildApp() {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
        allErrors: true,
      },
    },
  })

  registerCors(app)
  app.register(healthRoutes)
  app.register(resumeRoutes, { prefix: "/api/resumes" })
  app.register(coverLetterRoutes, { prefix: "/api/cover-letters" })
  registerErrorHandlers(app)
  app.register(docsRoutes)

  return app
}
