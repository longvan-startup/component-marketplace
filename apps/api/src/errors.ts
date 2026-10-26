/**
 * apps/api — central error primitives (issue #29 §B).
 *
 * Mọi response lỗi đi qua ENVELOPE của `apiErrorSchema` (`@marketplace/shared`)
 * — điều này giúp frontend (#32) + tests (#31) khẳng định hợp đồng (shape) mà
 * không cần suy đoán. Code UPPER_SNAKE, status 400–599, không stack trace
 * ở prod.
 *
 * Future endpoints (#31, Better Auth #17...) NÉN lỗi bằng `ApiHttpError`.
 * Lỗi khác (không kiểm soát) trở thành 500 INTERNAL_ERROR + được log phía
 * máy chủ — không bao giờ lộ chi tiết cho client.
 */

import { type ApiError, apiErrorSchema } from '@marketplace/shared'
import type { NextFunction, Request, Response } from 'express'

/** Lỗi "bị ném có ý đồ" từ các tầng ứng dụng (route/service/db). */
export class ApiHttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: string[]
  readonly expose: boolean

  constructor(status: number, code: string, message: string, details?: string[]) {
    super(message)
    this.name = 'ApiHttpError'
    this.status = status
    this.code = code
    this.details = details
    // expose=false: message chỉ có ý nghĩa nội bộ (log) — client nhận generic.
    this.expose = false
  }
}

/** LỆNH XUỐNG: mọi error response đi ra client đều qua HÀM NÀY duy nhất. */
export function sendError(res: Response, error: ApiError): void {
  // Runtime check theo hợp đồng: shape sai = lỗi lập trình rõ ràng (nén ngay
  // tại chỗ thay vì để shape drift trôi qua tests/frontend).
  const parsed = apiErrorSchema.safeParse(error)
  if (!parsed.success) {
    throw new TypeError(
      `Internal error shape violated contract: ${parsed.error.issues.length} issue(s)`,
    )
  }
  res.status(parsed.data.status).json(parsed.data)
}

/** Middleware 404 — path không match route nào, trả theo cùng envelope. */
export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, { code: 'NOT_FOUND', message: 'Route not found', status: 404 })
}

/**
 * Error middleware cuối — xử lý ApiHttpError, JSON body parse lỗi (SyntaxError
 * với err.status = 400 từ express.json()) và mọi lỗi chưa biết.
 * Client nhận message generic; chi tiết chỉ nằm ở log server.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // express.json() body-parse văng SyntaxError với err.status = 400.
  const malformed =
    error instanceof SyntaxError &&
    typeof (error as unknown as { status?: unknown }).status === 'number' &&
    (error as unknown as { status: number }).status === 400

  if (error instanceof ApiHttpError) {
    sendError(res, {
      code: error.code,
      message: error.message,
      status: error.status,
      ...(error.details ? { details: error.details } : {}),
    })
  } else if (malformed) {
    sendError(res, {
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON',
      status: 400,
    })
  } else if (typeof (error as unknown as { status?: unknown }).status === 'number') {
    // Express internal status errors (payload too large, ...) — generic message
    const status = (error as unknown as { status: number }).status
    if (status >= 400 && status < 500) {
      sendError(res, { code: 'REQUEST_ERROR', message: 'Request failed validation', status })
    } else {
      sendError(res, { code: 'INTERNAL_ERROR', message: 'Internal server error', status: 500 })
    }
  } else {
    sendError(res, { code: 'INTERNAL_ERROR', message: 'Internal server error', status: 500 })
  }

  // Log server-side duy nhất 1 lần (KHÔNG qua HTTP response). Stack chỉ cả
  // chi tiết nội bộ — prod: không in stack, không in giá trị env.
  console.error('[api] request error', {
    handled: error instanceof ApiHttpError,
    message: error instanceof Error ? error.message : String(error),
    stack:
      process.env.NODE_ENV === 'production'
        ? undefined
        : error instanceof Error
          ? error.stack
          : undefined,
  })
}
