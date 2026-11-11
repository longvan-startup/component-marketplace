/**
 * contracts/auth.ts — public API contract for the forgot/reset-password and
 * email-verification flows (issue #92, both slices). Source of truth for
 * BOTH sides (Văn ↔ Long).
 *
 * Unlike `catalog.ts`, these schemas describe `/api/auth/*` payloads, which
 * `apps/api/AGENTS.md` says the API must NOT wrap or translate — Better Auth
 * owns the wire shape. So this file is a type DESCRIPTION of an
 * already-fixed external contract (verified directly against
 * `better-auth@1.7.14`'s source in `api/routes/password.ts` and
 * `api/routes/email-verification.ts`), not a new envelope. Frontend code
 * maps the `error` callback param / `APIError` to UI states per
 * `apps/api/AUTH.md`'s "Frontend state mapping".
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

/* ------------------------------------------------------------------ */
/* Email verification (issue #92, slice 2) — mandatory before sign-in. */
/* ------------------------------------------------------------------ */

export const resendVerificationEmailRequestSchema = z.object({
  email: z.email(),
  callbackURL: z.string().optional(),
})

export const resendVerificationEmailResponseSchema = z.object({
  status: z.boolean(),
})

/** Error codes Better Auth's `/verify-email` GET callback can append to the
 * callback URL's query string (`?error=...`). Unlike password reset, a
 * verification link can distinguish "expired" from "otherwise invalid". */
export const verifyEmailCallbackErrorSchema = z.enum([
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'USER_NOT_FOUND',
])

export type ResendVerificationEmailRequest = z.infer<typeof resendVerificationEmailRequestSchema>
export type ResendVerificationEmailResponse = z.infer<typeof resendVerificationEmailResponseSchema>
export type VerifyEmailCallbackError = z.infer<typeof verifyEmailCallbackErrorSchema>

/* ------------------------------------------------------------------ */
/* Sign-in / sign-up / session (issue: web login + register pages).    */
/* Verified against `better-auth@1.7.14` `api/routes/sign-in.mjs`,     */
/* `sign-up.mjs`, `session.mjs`, `sign-out.mjs`. Dates arrive as ISO   */
/* strings over JSON. Unknown extra keys are stripped by `z.object`.   */
/* ------------------------------------------------------------------ */

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  emailVerified: z.boolean(),
})

export const signInEmailRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  callbackURL: z.string().optional(),
  rememberMe: z.boolean().optional(),
})

export const signInEmailResponseSchema = z.object({
  redirect: z.boolean(),
  token: z.string(),
  url: z.string().optional(),
  user: authUserSchema,
})

export const signUpEmailRequestSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8).max(128),
  callbackURL: z.string().optional(),
})

/** `token` is `null` whenever sign-up does not auto sign-in — always the
 * case here, since `requireEmailVerification: true` (apps/api auth config). */
export const signUpEmailResponseSchema = z.object({
  token: z.string().nullable(),
  user: authUserSchema,
})

/** `GET /api/auth/get-session` — JSON `null` when there is no session. */
export const getSessionResponseSchema = z
  .object({
    session: z.object({
      id: z.string(),
      userId: z.string(),
      expiresAt: z.string(),
    }),
    user: authUserSchema,
  })
  .nullable()

export const signOutResponseSchema = z.object({
  success: z.boolean(),
})

/** Better Auth error codes the sign-in / sign-up UI maps to messages.
 * Sign-up reports an existing email with either of the two
 * `USER_ALREADY_EXISTS*` codes depending on the code path. */
export const authFormErrorCodeSchema = z.enum([
  'INVALID_EMAIL_OR_PASSWORD',
  'EMAIL_NOT_VERIFIED',
  'USER_ALREADY_EXISTS',
  'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  'INVALID_EMAIL',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
])

export type AuthUser = z.infer<typeof authUserSchema>
export type SignInEmailRequest = z.infer<typeof signInEmailRequestSchema>
export type SignInEmailResponse = z.infer<typeof signInEmailResponseSchema>
export type SignUpEmailRequest = z.infer<typeof signUpEmailRequestSchema>
export type SignUpEmailResponse = z.infer<typeof signUpEmailResponseSchema>
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>
export type SignOutResponse = z.infer<typeof signOutResponseSchema>
export type AuthFormErrorCode = z.infer<typeof authFormErrorCodeSchema>
