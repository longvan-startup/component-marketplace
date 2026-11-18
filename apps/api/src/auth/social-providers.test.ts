import { describe, expect, test } from 'bun:test'
import { configuredSocialProviderIds, socialProvidersFromEnv } from './config'

const ENV = {
  NODE_ENV: 'test' as const,
  BETTER_AUTH_SECRET: undefined,
  BETTER_AUTH_URL: undefined,
  CORS_ORIGINS: undefined,
  RESEND_API_KEY: undefined,
  AUTH_EMAIL_FROM: undefined,
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  GITHUB_CLIENT_ID: undefined,
  GITHUB_CLIENT_SECRET: undefined,
}

describe('socialProvidersFromEnv', () => {
  test('includes only providers that have both id and secret', () => {
    const providers = socialProvidersFromEnv({
      ...ENV,
      GITHUB_CLIENT_ID: 'github-client',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GOOGLE_CLIENT_ID: 'google-client',
    })
    expect(Object.keys(providers)).toEqual(['github'])
    expect(
      configuredSocialProviderIds({
        ...ENV,
        GITHUB_CLIENT_ID: 'github-client',
        GITHUB_CLIENT_SECRET: 'github-secret',
        GOOGLE_CLIENT_ID: 'google-client',
      }),
    ).toEqual(['github'])
    expect(providers.github).toEqual({ clientId: 'github-client', clientSecret: 'github-secret' })
  })
})
