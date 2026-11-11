/**
 * Auth data layer (issue #92, both slices — forgot/reset password + mandatory
 * email verification) — the ONLY module allowed to know how these calls
 * reach the backend. Mirrors `features/catalog/catalog-source.ts`'s
 * mock/HTTP/`API_MODE` split exactly.
 *
 * Unlike catalog, the HTTP source is typed against `@marketplace/shared`'s
 * `contracts/auth.ts` directly — that contract already mirrors Better Auth's
 * real wire shape (see that file's header), so there's no "proposal pending
 * review" staleness risk here the way catalog-source.ts flagged.
 */

import {
  type GetSessionResponse,
  getSessionResponseSchema,
  type RequestPasswordResetResponse,
  type ResendVerificationEmailResponse,
  type ResetPasswordResponse,
  requestPasswordResetResponseSchema,
  resendVerificationEmailResponseSchema,
  resetPasswordResponseSchema,
  type SignInEmailResponse,
  type SignOutResponse,
  type SignUpEmailResponse,
  signInEmailResponseSchema,
  signOutResponseSchema,
  signUpEmailResponseSchema,
} from '@marketplace/shared'
import { ApiClientError, apiFetchJson, apiMutateJson } from '../../lib/api-client'

export interface AuthSource {
  signIn(email: string, password: string): Promise<SignInEmailResponse>
  signUp(
    input: { name: string; email: string; password: string },
    callbackURL: string,
  ): Promise<SignUpEmailResponse>
  /** Resolves `null` when nobody is signed in. */
  getSession(): Promise<GetSessionResponse>
  signOut(): Promise<SignOutResponse>
  requestPasswordReset(email: string, redirectTo: string): Promise<RequestPasswordResetResponse>
  resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse>
  resendVerificationEmail(
    email: string,
    callbackURL: string,
  ): Promise<ResendVerificationEmailResponse>
}

/** Error thrown by `resetPassword` when Better Auth rejects the token or
 * the new password. `code` is the machine-readable Better Auth error code
 * (e.g. `INVALID_TOKEN`, `PASSWORD_TOO_SHORT`) — callers must match on
 * `code`, never on `message`, which is human prose. */
export class ResetPasswordError extends Error {
  readonly status: number
  readonly code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ResetPasswordError'
    this.status = status
    this.code = code
  }
}

/** Error thrown by `signIn` / `signUp` when Better Auth rejects the request.
 * `code` is one of `authFormErrorCodeSchema` in `@marketplace/shared` when
 * the backend sent one — match on `code`, never on `message`. */
export class AuthRequestError extends Error {
  readonly status: number
  readonly code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'AuthRequestError'
    this.status = status
    this.code = code
  }
}

function toAuthRequestError(error: unknown): unknown {
  return error instanceof ApiClientError
    ? new AuthRequestError(error.status, error.message, error.code)
    : error
}

/* ------------------------------------------------------------------ */
/* Mock source — the default until a real backend is reachable.        */
/* ------------------------------------------------------------------ */

function mockUser(email: string, name = 'Người dùng thử') {
  return { id: 'mock-user', email, name, image: null, emailVerified: true }
}

const GENERIC_REQUEST_MESSAGE =
  'If this email exists in our system, check your email for the reset link'

export function createMockAuthSource(): AuthSource {
  return {
    // Mock mode keeps no session: `signIn` succeeds (except the sentinel
    // password 'wrong') but `getSession` stays signed-out.
    signIn: async (email, password) => {
      if (password === 'wrong') {
        throw new AuthRequestError(401, 'Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD')
      }
      return { redirect: false, token: 'mock-token', user: mockUser(email) }
    },
    signUp: async ({ name, email }) => ({
      token: null,
      user: { ...mockUser(email, name), emailVerified: false },
    }),
    getSession: async () => null,
    signOut: async () => ({ success: true }),
    requestPasswordReset: async () => ({ status: true, message: GENERIC_REQUEST_MESSAGE }),
    resetPassword: async (token) => {
      if (token === 'expired' || token === 'invalid') {
        throw new ResetPasswordError(400, 'Invalid token', 'INVALID_TOKEN')
      }
      return { status: true }
    },
    resendVerificationEmail: async () => ({ status: true }),
  }
}

/* ------------------------------------------------------------------ */
/* HTTP source — typed against the real Better Auth contract.          */
/* ------------------------------------------------------------------ */

interface HttpDeps {
  fetchImpl?: typeof fetch
  publicApiUrl?: string
  internalApiUrl?: string
  runtime?: 'browser' | 'server'
}

/**
 * Better Auth is ALWAYS mounted at `/api/auth/*` in `apps/api/src/index.ts`
 * (`apps/api/AUTH.md`: "All routes are under /api/auth"), unlike the
 * catalog router, which conditionally mounts at root `/` or dual-mounts at
 * `/` + `/api` depending on `VERCEL`/`resolveMountPaths()`. That's why
 * catalog paths are root-relative (`/components`) against
 * `api-client.ts`'s `DEFAULT_API_BASE` ('/api', the same-origin Vercel
 * rewrite convention) — but reusing that same convention here would double
 * up the `/api` segment in same-origin mode, or drop it entirely in
 * explicit-origin (Docker/local) mode. So auth paths resolve their own
 * base (same-origin root, not '/api') and always spell out `/api/auth/...`
 * in full — this works unchanged across same-origin Vercel, a dedicated
 * API domain, and local Docker, using the exact same `NEXT_PUBLIC_API_URL`/
 * `API_URL_INTERNAL` values catalog already reads.
 */
function resolveAuthBaseUrl(deps: HttpDeps): string {
  const runtime = deps.runtime ?? (typeof window === 'undefined' ? 'server' : 'browser')
  const internal = deps.internalApiUrl ?? process.env.API_URL_INTERNAL
  const external = deps.publicApiUrl ?? process.env.NEXT_PUBLIC_API_URL
  return (runtime === 'server' && internal ? internal : external) ?? ''
}

export function createHttpAuthSource(deps: HttpDeps = {}): AuthSource {
  const base = resolveAuthBaseUrl(deps)
  const authDeps = { ...deps, publicApiUrl: base, internalApiUrl: base }

  return {
    signIn: async (email, password) => {
      try {
        const payload = await apiMutateJson<unknown>(
          '/api/auth/sign-in/email',
          { email, password },
          authDeps,
        )
        return signInEmailResponseSchema.parse(payload)
      } catch (error) {
        throw toAuthRequestError(error)
      }
    },
    signUp: async (input, callbackURL) => {
      try {
        const payload = await apiMutateJson<unknown>(
          '/api/auth/sign-up/email',
          { ...input, callbackURL },
          authDeps,
        )
        return signUpEmailResponseSchema.parse(payload)
      } catch (error) {
        throw toAuthRequestError(error)
      }
    },
    getSession: async () => {
      const payload = await apiFetchJson<unknown>('/api/auth/get-session', {
        ...authDeps,
        credentials: 'include',
      })
      return getSessionResponseSchema.parse(payload)
    },
    signOut: async () => {
      const payload = await apiMutateJson<unknown>('/api/auth/sign-out', {}, authDeps)
      return signOutResponseSchema.parse(payload)
    },
    requestPasswordReset: async (email, redirectTo) => {
      const payload = await apiMutateJson<unknown>(
        '/api/auth/request-password-reset',
        { email, redirectTo },
        authDeps,
      )
      return requestPasswordResetResponseSchema.parse(payload)
    },
    resetPassword: async (token, newPassword) => {
      try {
        const payload = await apiMutateJson<unknown>(
          '/api/auth/reset-password',
          { token, newPassword },
          authDeps,
        )
        return resetPasswordResponseSchema.parse(payload)
      } catch (error) {
        if (error instanceof ApiClientError) {
          throw new ResetPasswordError(error.status, error.message, error.code)
        }
        throw error
      }
    },
    resendVerificationEmail: async (email, callbackURL) => {
      const payload = await apiMutateJson<unknown>(
        '/api/auth/send-verification-email',
        { email, callbackURL },
        authDeps,
      )
      return resendVerificationEmailResponseSchema.parse(payload)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Selection — API_MODE=mock|live (mock is the safe default).          */
/* ------------------------------------------------------------------ */

export type ApiMode = 'mock' | 'live'

/**
 * Server-only: reads `process.env.API_MODE`. Unlike `catalog-source.ts`
 * (which only ever runs in Server Components), these auth sources are
 * consumed from `'use client'` forms — `process.env.API_MODE` is NOT
 * inlined into the browser bundle (only `NEXT_PUBLIC_*` vars are), so the
 * resolved mode must be read here, server-side, and threaded down as a
 * prop. Calling this from the browser silently falls back to 'mock' — that
 * is the deliberate safe default, not a bug, but it means client code must
 * never call it to decide its own mode.
 */
export function resolveApiMode(mode = process.env.API_MODE): ApiMode {
  return mode === 'live' ? 'live' : 'mock'
}

/** One call site for forms; takes the mode explicitly (resolved
 * server-side by the page and passed down as a prop) rather than
 * re-resolving `API_MODE` itself. */
export function getAuthSource(mode: ApiMode, deps: HttpDeps = {}): AuthSource {
  return mode === 'live' ? createHttpAuthSource(deps) : createMockAuthSource()
}
