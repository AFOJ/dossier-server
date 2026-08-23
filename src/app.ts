import Fastify from "fastify"
import { healthRoutes, resumeRoutes } from "./routes/index.js"
import { registerErrorHandlers } from "./plugins/error-handler.js"

export function buildApp() {
  const app = Fastify({
    logger: true,
    // Reject unknown properties instead of silently stripping them.
    ajv: {
      customOptions: {
        removeAdditional: false,
        allErrors: true,
      },
    },
  })

  app.register(healthRoutes)
  app.register(resumeRoutes, { prefix: "/api/resumes" })
  registerErrorHandlers(app)

  return app
}
