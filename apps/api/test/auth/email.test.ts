import { describe, expect, test } from 'bun:test'

import { createAuthEmailSender } from '../../src/auth/email'

const productionEnv = {
  NODE_ENV: 'production' as const,
  RESEND_API_KEY: 're_test_secret',
  AUTH_EMAIL_FROM: 'accounts@example.test',
}

describe('createAuthEmailSender', () => {
  test('sends verification email through Resend with text and escaped HTML', async () => {
    let requestUrl = ''
    let requestInit: RequestInit | undefined
    const send = createAuthEmailSender(productionEnv, async (input, init) => {
      requestUrl = String(input)
      requestInit = init
      return new Response(null, { status: 202 })
    })

    await send({
      kind: 'verification',
      user: { email: 'person@example.test', name: '<A & B>' },
      url: 'https://marketplace.test/verify?token=a&b',
    })

    expect(requestUrl).toBe('https://api.resend.com/emails')
    expect(requestInit?.method).toBe('POST')
    expect(new Headers(requestInit?.headers).get('authorization')).toBe('Bearer re_test_secret')
    expect(new Headers(requestInit?.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      from: 'Marketplace <accounts@example.test>',
      to: ['person@example.test'],
      subject: 'Verify your Component Marketplace email',
      text: 'Hi <A & B>,\n\nVerify your email address: https://marketplace.test/verify?token=a&b\n\nIf you did not request this, you can ignore this email.',
      html: '<p>Hi &lt;A &amp; B&gt;,</p><p><a href="https://marketplace.test/verify?token=a&amp;b">Verify your email address</a></p><p>If you did not request this, you can ignore this email.</p>',
    })
  })

  test('sends password resets through the same production provider', async () => {
    let payload: Record<string, unknown> | undefined
    const send = createAuthEmailSender(productionEnv, async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(null, { status: 200 })
    })

    await send({
      kind: 'password-reset',
      user: { email: 'person@example.test' },
      url: 'https://marketplace.test/reset?token=secret',
    })

    expect(payload?.subject).toBe('Reset your Component Marketplace password')
    expect(payload?.text).toContain(
      'Reset your password: https://marketplace.test/reset?token=secret',
    )
  })

  test('fails generically when production email configuration is absent', async () => {
    const send = createAuthEmailSender({ NODE_ENV: 'production' }, async () => {
      throw new Error('fetch should not run')
    })

    await expect(
      send({
        kind: 'verification',
        user: { email: 'person@example.test' },
        url: 'https://marketplace.test/verify?token=private-token',
      }),
    ).rejects.toThrow('Email delivery is not configured')
  })

  test('does not include provider response details in failures', async () => {
    const send = createAuthEmailSender(
      productionEnv,
      async () => new Response('provider-error-private-detail', { status: 403 }),
    )

    const messages: string[] = []
    const originalLog = console.log
    console.log = (...values: unknown[]) => messages.push(values.map(String).join(' '))
    try {
      await expect(
        send({
          kind: 'verification',
          user: { email: 'person@example.test' },
          url: 'https://marketplace.test/verify?token=private-token',
        }),
      ).rejects.toThrow('Email delivery failed')
    } finally {
      console.log = originalLog
    }

    expect(messages).toEqual([])
  })

  test('keeps the link transport in development for local auth testing', async () => {
    const messages: string[] = []
    const originalLog = console.log
    console.log = (...values: unknown[]) => messages.push(values.map(String).join(' '))
    try {
      const send = createAuthEmailSender({ NODE_ENV: 'test' }, async () => {
        throw new Error('test transport should not run')
      })
      await send({
        kind: 'verification',
        user: { email: 'person@example.test' },
        url: 'http://localhost/verify?token=test-token',
      })
    } finally {
      console.log = originalLog
    }

    expect(messages).toEqual([
      '[dev] verification link for person@example.test: http://localhost/verify?token=test-token',
    ])
  })
})
