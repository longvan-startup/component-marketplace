/**
 * env validation tests (issue #29 §A).
 *
 * parseApiEnv phải: nhận config hợp lệ (kể cả thiếu DATABASE_URL/CORS), từ
 * chối giá trị sai với message chỉ nêu TÊN biến (không lộ giá trị), và
 * normalize CSV origins.
 */

import { describe, expect, test } from 'bun:test'

import { ApiConfigError, parseApiEnv } from './env'

describe('parseApiEnv', () => {
  test('config mặc định hợp lệ khi env rỗng (PORT 4000, dev, không DB)', () => {
    const env = parseApiEnv({})
    expect(env.PORT).toBe(4000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.CORS_ORIGINS).toBeUndefined()
  })

  test('PORT/NODE_ENV/URL hợp lệ được giữ đúng', () => {
    const env = parseApiEnv({
      PORT: '8888',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@db.internal:5432/app',
      CORS_ORIGINS: 'https://a.example, https://b.example',
    })
    expect(env.PORT).toBe(8888)
    expect(env.NODE_ENV).toBe('production')
    expect(env.DATABASE_URL).toBe('postgresql://postgres:secret@db.internal:5432/app')
    // CSV + whitespace được normalize thành exact-match list.
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example'])
  })

  test('PORT sai loại ⇒ ApiConfigError nêu TÊN biến, KHÔNG in giá trị', () => {
    let captured: unknown
    try {
      parseApiEnv({ PORT: 'foo' })
      captured = 'no-throw'
    } catch (error) {
      captured = error
    }
    expect(captured).toBeInstanceOf(ApiConfigError)
    const message = (captured as ApiConfigError).message
    expect(message).toContain('PORT')
    expect(message).not.toContain('foo')
  })

  test('PORT ngoài biên (0 / 70000) ⇒ lỗi', () => {
    expect(() => parseApiEnv({ PORT: '0' })).toThrow(ApiConfigError)
    expect(() => parseApiEnv({ PORT: '70000' })).toThrow(ApiConfigError)
  })

  test('NODE_ENV ngoài enum ⇒ lỗi', () => {
    expect(() => parseApiEnv({ NODE_ENV: 'chaotic' })).toThrow(ApiConfigError)
  })

  test('DATABASE_URL sai scheme ⇒ lỗi (khó dò sâu nếu đã set thì phải chuẩn)', () => {
    expect(() => parseApiEnv({ DATABASE_URL: 'mysql://...@x/y' })).toThrow(ApiConfigError)
    // Chuỗi rỗng coi như "không cấu hình" — phải được chấp nhận (degraded).
    const env = parseApiEnv({ DATABASE_URL: '' })
    expect(env.DATABASE_URL).toBeUndefined()
  })

  test('biến lạ không bị từ chối (Vercel/compose inject nhiều biến)', () => {
    const env = parseApiEnv({ VERCEL: '1', SOME_RANDOM: 'x' })
    expect(env.PORT).toBe(4000)
  })

  test('message lỗi không chứa DATABASE_URL khi nó sai scheme', () => {
    try {
      parseApiEnv({ DATABASE_URL: 'junk' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiConfigError)
      expect((error as ApiConfigError).message).not.toContain('junk')
    }
  })
})
