import { type Database, schema } from '@marketplace/db'
import { APIError, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'

import type { ApiEnv } from '../env'
import { createAuthEmailSender } from './email'

type AuthEnvironment = Pick<
  ApiEnv,
  | 'NODE_ENV'
  | 'BETTER_AUTH_SECRET'
  | 'BETTER_AUTH_URL'
  | 'CORS_ORIGINS'
  | 'RESEND_API_KEY'
  | 'AUTH_EMAIL_FROM'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GITHUB_CLIENT_ID'
  | 'GITHUB_CLIENT_SECRET'
>

export type SocialProviderId = 'google' | 'github'

/** Provider ids that have both a client id and a secret. Secrets stay in the auth config. */
export function configuredSocialProviderIds(env: AuthEnvironment): SocialProviderId[] {
  const ids: SocialProviderId[] = []
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) ids.push('google')
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) ids.push('github')
  return ids
}

export function createAuth(db: Database, env: AuthEnvironment) {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    throw new Error('Better Auth configuration is incomplete')
  }

  const trustedOrigins = [new URL(env.BETTER_AUTH_URL).origin, ...(env.CORS_ORIGINS ?? [])]
  const sendAuthEmail = createAuthEmailSender(env)
  const socialProviders = {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  }

  return betterAuth({
    appName: 'Component Marketplace',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...new Set(trustedOrigins)],
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
      },
    },
    database: drizzleAdapter(db, {
      provider: 'pg',
      transaction: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
      usePlural: true,
    }),
    user: {
      additionalFields: {
        role: {
          type: ['user', 'seller', 'admin'],
          required: false,
          defaultValue: 'user',
          input: false,
          returned: true,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Issue #92 slice 2 decision: verification is mandatory. Sign-up no
      // longer returns a session (Better Auth's own `shouldSkipAutoSignIn`
      // logic skips it automatically once this is true) and sign-in 403s
      // with EMAIL_NOT_VERIFIED until the user verifies — both enforced by
      // Better Auth itself, nothing custom needed on our side.
      requireEmailVerification: true,
      // 15 min (issue #92 decision) — Better Auth's own default is 1h.
      resetPasswordTokenExpiresIn: 15 * 60,
      // Old password stops working everywhere the moment a reset succeeds.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({ kind: 'password-reset', user, url })
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({ kind: 'verification', user, url })
      },
      sendOnSignUp: true,
      // A failed sign-in due to an unverified email quietly sends a fresh
      // link too, so a user who lost the first email isn't stuck — no
      // separate "resend" trigger needed on that path.
      sendOnSignIn: true,
      // Clicking the link logs the user straight in instead of making them
      // sign in again right after proving they own the email.
      autoSignInAfterVerification: true,
      // 15 min (issue #92 decision) — Better Auth's own default is 1h.
      expiresIn: 15 * 60,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/update-user') return

        const { name, image } = ctx.body ?? {}
        if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) {
          throw new APIError('BAD_REQUEST', { message: 'Name must be 1 to 100 characters' })
        }
        if (image !== undefined && image !== null) {
          if (typeof image !== 'string' || image.length > 2048) {
            throw new APIError('BAD_REQUEST', { message: 'Image must be an HTTPS URL or null' })
          }
          try {
            const url = new URL(image)
            if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
          } catch {
            throw new APIError('BAD_REQUEST', { message: 'Image must be an HTTPS URL or null' })
          }
        }
      }),
    },
    advanced: {
      database: {
        // Generate IDs in the app: auth tables use both UUID and text columns,
        // and the text primary keys do not have database defaults.
        generateId: () => crypto.randomUUID(),
      },
    },
  })
}

export type MarketplaceAuth = ReturnType<typeof createAuth>
