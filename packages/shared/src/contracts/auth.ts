/**
 * contracts/auth.ts — public API contract for the forgot/reset-password flow
 * (issue #92, slice 1). Source of truth for BOTH sides (Văn ↔ Long).
 *
 * Unlike `catalog.ts`, these schemas describe `/api/auth/*` payloads, which
 * `apps/api/AGENTS.md` says the API must NOT wrap or translate — Better Auth
 * owns the wire shape. So this file is a type DESCRIPTION of an
 * already-fixed external contract (verified directly against
 * `better-auth@1.7.14`'s source in `api/routes/password.ts`), not a new
 * envelope. Frontend code maps the `error` callback param / `APIError` to UI
 * states per `apps/api/AUTH.md`'s "Frontend state mapping".
 *
 * `newPassword` bounds (8–128) mirror Better Auth's own defaults
 * (`minPasswordLength`/`maxPasswordLength`, unset in `apps/api/src/auth/
 * config.ts` so the library defaults apply) — update both places together if
 * that config ever changes.
 */

import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Requests & responses — mirror Better Auth's own wire shape exactly. */
/* ------------------------------------------------------------------ */

export const requestPasswordResetRequestSchema = z.object({
  email: z.email(),
  redirectTo: z.string().optional(),
})

export const requestPasswordResetResponseSchema = z.object({
  status: z.boolean(),
  message: z.string().optional(),
})

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

export const resetPasswordResponseSchema = z.object({
  status: z.boolean(),
})

/** The only error code Better Auth's `/reset-password/:token` GET callback
 * redirects with, for both an invalid and an expired token (same code). */
export const resetPasswordCallbackErrorSchema = z.enum(['INVALID_TOKEN'])

export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetRequestSchema>
export type RequestPasswordResetResponse = z.infer<typeof requestPasswordResetResponseSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>
export type ResetPasswordCallbackError = z.infer<typeof resetPasswordCallbackErrorSchema>
