import { type Database, schema } from '@marketplace/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import type { ApiEnv } from '../env'

type AuthEnvironment = Pick<ApiEnv, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'CORS_ORIGINS'>

export function createAuth(db: Database, env: AuthEnvironment) {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    throw new Error('Better Auth configuration is incomplete')
  }

  const trustedOrigins = [new URL(env.BETTER_AUTH_URL).origin, ...(env.CORS_ORIGINS ?? [])]

  return betterAuth({
    appName: 'Component Marketplace',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...new Set(trustedOrigins)],
    database: drizzleAdapter(db, {
      provider: 'pg',
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
      requireEmailVerification: false,
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
