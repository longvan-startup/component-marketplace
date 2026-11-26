import { describe, expect, test } from 'bun:test'

import { AUTH_LINK_TTL_MINUTES, createAuthEmailSender } from '../../src/auth/email'

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
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(requestInit?.headers).get('authorization')).toBe('Bearer re_test_secret')
    expect(new Headers(requestInit?.headers).get('content-type')).toBe('application/json')
    const payload = JSON.parse(String(requestInit?.body)) as {
      from: string
      to: string[]
      subject: string
      text: string
      html: string
      attachments: { filename: string; content: string; content_id: string }[]
    }
    expect(payload.from).toBe('Luva UI <accounts@example.test>')
    expect(payload.to).toEqual(['person@example.test'])
    expect(payload.subject).toBe('Xác minh email tài khoản Luva UI')
    // The artwork travels inline and the HTML points at each picture with cid:.
    expect(payload.attachments.map((file) => file.content_id)).toEqual([
      'luva-wordmark',
      'luva-hero',
      'luva-team',
      'luva-footer',
    ])
    for (const file of payload.attachments) {
      expect(payload.html).toContain(`src="cid:${file.content_id}"`)
      expect(file.content.length).toBeGreaterThan(100)
    }
    // The long link is not printed in the email; the button and one text link carry it.
    expect(payload.html).not.toContain('>https://marketplace.test')
    expect(payload.text).toContain('Chào <A & B>,')
    expect(payload.text).toContain('Xác minh email: https://marketplace.test/verify?token=a&b')
    // The name and the URL are escaped in the HTML, and the URL is on both the
    // button and the fallback link.
    expect(payload.html).toContain('Chào &lt;A &amp; B&gt;,')
    expect(payload.html).not.toContain('<A & B>')
    expect(
      payload.html.split('href="https://marketplace.test/verify?token=a&amp;b"').length - 1,
    ).toBe(2)
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

    expect(payload?.subject).toBe('Đặt lại mật khẩu Luva UI')
    expect(payload?.text).toContain('Đặt lại mật khẩu: https://marketplace.test/reset?token=secret')
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

  test('logs only the provider status when Resend rejects an email', async () => {
    const send = createAuthEmailSender(
      productionEnv,
      async () => new Response('provider-error-private-detail', { status: 403 }),
    )

    const logged: unknown[][] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => logged.push(values)
    try {
      await expect(
        send({
          kind: 'verification',
          user: { email: 'person@example.test' },
          url: 'https://marketplace.test/verify?token=private-token',
        }),
      ).rejects.toThrow('Email delivery failed')
    } finally {
      console.error = originalError
    }

    expect(logged).toEqual([
      ['[auth-email] Resend rejected email', { kind: 'verification', status: 403 }],
    ])
    expect(JSON.stringify(logged)).not.toContain('provider-error-private-detail')
    expect(JSON.stringify(logged)).not.toContain('private-token')
    expect(JSON.stringify(logged)).not.toContain('person@example.test')
  })

  test('logs only safe network metadata when the Resend request fails', async () => {
    const cause = Object.assign(new Error('private provider request detail'), {
      code: 'ECONNRESET',
    })
    const send = createAuthEmailSender(productionEnv, async () => {
      throw new TypeError('fetch failed', { cause })
    })

    const logged: unknown[][] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => logged.push(values)
    try {
      await expect(
        send({
          kind: 'verification',
          user: { email: 'person@example.test' },
          url: 'https://marketplace.test/verify?token=private-token',
        }),
      ).rejects.toThrow('Email delivery failed')
    } finally {
      console.error = originalError
    }

    expect(logged).toEqual([
      [
        '[auth-email] Resend request failed',
        { kind: 'verification', errorName: 'TypeError', errorCode: 'ECONNRESET' },
      ],
    ])
    expect(JSON.stringify(logged)).not.toContain('private provider request detail')
    expect(JSON.stringify(logged)).not.toContain('private-token')
    expect(JSON.stringify(logged)).not.toContain('person@example.test')
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

  test('the email says how long the link lasts, from the same constant as the token lifetime', async () => {
    let payload: { html: string; text: string } | undefined
    const send = createAuthEmailSender(productionEnv, async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as { html: string; text: string }
      return new Response(null, { status: 200 })
    })

    await send({
      kind: 'password-reset',
      user: { email: 'person@example.test' },
      url: 'https://marketplace.test/reset?token=secret',
    })

    expect(payload?.html).toContain(`${AUTH_LINK_TTL_MINUTES} phút`)
    expect(payload?.text).toContain(`${AUTH_LINK_TTL_MINUTES} phút`)
  })

  test('greets a missing or blank name with a plain greeting and keeps markup in a name inert', async () => {
    const bodies: { html: string; text: string }[] = []
    const send = createAuthEmailSender(productionEnv, async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)) as { html: string; text: string })
      return new Response(null, { status: 200 })
    })
    const url = 'https://marketplace.test/verify?token=x'

    await send({ kind: 'verification', user: { email: 'a@example.test', name: '   ' }, url })
    await send({
      kind: 'verification',
      user: { email: 'a@example.test', name: '<script>alert(1)</script>' },
      url,
    })

    expect(bodies[0]?.text.startsWith('Chào bạn,')).toBe(true)
    expect(bodies[1]?.html).not.toContain('<script>')
    expect(bodies[1]?.html).toContain('&lt;script&gt;')
  })
})
