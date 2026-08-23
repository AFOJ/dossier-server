import type { FastifyReply } from "fastify"

export abstract class ResponseHandler extends Error {
  constructor(
    readonly statusCode: number,
    message = "",
  ) {
    super(message)
    this.name = new.target.name
  }

  abstract toBody(): unknown

  send(reply: FastifyReply): void {
    void reply.status(this.statusCode).send(this.toBody())
  }
}

export type ApiErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "COMPILE_ERROR" | "INTERNAL_ERROR"

export interface ErrorEnvelope {
  error: {
    code: ApiErrorCode
    message: string
    details: unknown[]
  }
}

export class ErrorResponse extends ResponseHandler {
  readonly code: ApiErrorCode
  declare readonly message: string
  readonly details: unknown[]

  constructor(statusCode: number, code: ApiErrorCode, message: string, details: unknown[] = []) {
    super(statusCode, message)
    this.code = code
    this.details = details
  }

  override toBody(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    }
  }

  static validation(message = "Invalid request", details: unknown[] = []): ErrorResponse {
    return new ErrorResponse(400, "VALIDATION_ERROR", message, details)
  }

  static notFound(message = "Route not found"): ErrorResponse {
    return new ErrorResponse(404, "NOT_FOUND", message)
  }

  static unprocessable(
    code: ApiErrorCode,
    message: string,
    details: unknown[] = [],
  ): ErrorResponse {
    return new ErrorResponse(422, code, message, details)
  }

  static internal(): ErrorResponse {
    return new ErrorResponse(500, "INTERNAL_ERROR", "Unexpected server error")
  }
}

export class LaTeXCompileError extends ErrorResponse {
  readonly logExcerpt: string

  constructor(message: string, logExcerpt: string) {
    super(422, "COMPILE_ERROR", message, [logExcerpt])
    this.logExcerpt = logExcerpt
  }
}
