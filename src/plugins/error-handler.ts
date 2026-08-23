import type { FastifyError, FastifyInstance } from "fastify"
import { ErrorResponse, ResponseHandler } from "../responses.js"

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    ErrorResponse.notFound().send(reply)
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Message stays generic because validation is shared by every route.
    if (error.validation) {
      const response = ErrorResponse.validation(
        "Invalid request",
        error.validation.map((v) => ({
          path: v.instancePath || "/",
          message: v.message ?? "is invalid",
        })),
      )
      request.log.debug({ details: response.details }, "request validation failed")
      return response.send(reply)
    }

    if (error instanceof ResponseHandler) {
      const context =
        error instanceof ErrorResponse
          ? { code: error.code, details: error.details }
          : { statusCode: error.statusCode }
      if (error.statusCode >= 500) {
        request.log.error({ err: error, ...context }, "unhandled response")
      } else {
        request.log.warn(context, "controlled error")
      }
      return error.send(reply)
    }

    // Log everything, reveal nothing.
    request.log.error({ err: error }, "unhandled error")
    return ErrorResponse.internal().send(reply)
  })
}
