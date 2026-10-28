/**
 * env validation tests (issue #29 §A).
 *
 * parseApiEnv phải: nhận config hợp lệ (kể cả thiếu DATABASE_URL/CORS), từ
 * chối giá trị sai với message chỉ nêu TÊN biến (không lộ giá trị), và
 * normalize CSV origins.
 */

import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ApiConfigError, applyDotEnvFile, parseApiEnv, resolveRootDotEnvPath } from './env'

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

describe('applyDotEnvFile (issue #70)', () => {
  test('fill-only: key đã có (kể cả rỗng) KHÔNG bị ghi đè', () => {
    const dir = mkdtempSync(`${tmpdir()}/env-test-`)
    const file = join(dir, '.env')
    writeFileSync(file, 'FRESH_KEY=hello\nEXISTING_KEY=new-value\n', 'utf8')
    const target: Record<string, string | undefined> = { EXISTING_KEY: '' }
    const count = applyDotEnvFile(file, target)
    expect(count).toBe(1) // chỉ FRESH_KEY
    expect(target.FRESH_KEY).toBe('hello')
    expect(target.EXISTING_KEY).toBe('') // env thật thắng, kể cả rỗng
    rmSync(dir, { recursive: true, force: true })
  })

  test('bỏ qua comment/trống/line sai định dạng/key sai identifier; strip quotes', () => {
    const dir = mkdtempSync(`${tmpdir()}/env-test-`)
    const file = join(dir, '.env')
    writeFileSync(
      file,
      [
        '# comment line',
        '',
        '   ',
        'NO_EQUALS_SIGN_HERE',
        '=starts-with-equals',
        'BAD-KEY=1',
        'QUOTED="hello world"',
        "SINGLE='goodbye'",
        'GOOD=x',
      ].join('\n'),
      'utf8',
    )
    const target: Record<string, string | undefined> = {}
    const count = applyDotEnvFile(file, target)
    expect(count).toBe(3) // QUOTED, SINGLE, GOOD
    expect(target.QUOTED).toBe('hello world')
    expect(target.SINGLE).toBe('goodbye')
    expect(target.GOOD).toBe('x')
    rmSync(dir, { recursive: true, force: true })
  })

  test('file không tồn tại ⇒ im lặng trả 0 (không throw)', () => {
    expect(applyDotEnvFile('/nonexistent-dir-1a2b3c/.env', {})).toBe(0)
  })

  test('resolveRootDotEnvPath: walk-up tìm .env từ src lẫn dist (fixture thật)', () => {
    const repoRoot = mkdtempSync(`${tmpdir()}/envwalk-`)
    const deepSrc = join(repoRoot, 'apps', 'api', 'src')
    const deepDist = join(repoRoot, 'apps', 'api', 'dist')
    for (const dir of [deepSrc, deepDist]) mkdirSync(dir, { recursive: true })
    const dotEnv = join(repoRoot, '.env')
    writeFileSync(dotEnv, 'X=1\n', 'utf8')
    //Đầu vào là FILE path (giống import.meta.url sau fileURLToPath):
    expect(resolveRootDotEnvPath(join(deepSrc, 'index.ts'))).toBe(dotEnv)
    expect(resolveRootDotEnvPath(join(deepDist, 'index.js'))).toBe(dotEnv)
    // Không có .env trong mọi cấp gần ⇒ chuỗi rỗng (applyDotEnvFile no-op).
    const emptyRoot = mkdtempSync(`${tmpdir()}/envwalk-none-`)
    mkdirSync(join(emptyRoot, 'apps', 'api', 'src'), { recursive: true })
    expect(resolveRootDotEnvPath(join(emptyRoot, 'apps', 'api', 'src', 'index.ts'))).toBe('')
    rmSync(repoRoot, { recursive: true, force: true })
    rmSync(emptyRoot, { recursive: true, force: true })
  })
})
