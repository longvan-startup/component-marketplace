/**
 * Migration 0006 preflight — Postgres thật, database riêng.
 *
 * Catalog integration migrate hết journal lên `marketplace_test`. Nhét dòng
 * "có giá, cờ false" vào đó sẽ làm mọi lần migrate sau chết. File này tạo
 * database khác, áp 0000–0005, rồi chạy nguyên file 0006.
 *
 * Không có `TEST_DATABASE_URL` thì skip, cùng kiểu suite catalog.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres, { type Sql } from 'postgres'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip
const SCRATCH_DB = 'marketplace_access_tier_preflight'

function withDatabase(url: string, database: string): string {
  const next = new URL(url)
  next.pathname = `/${database}`
  return next.toString()
}

function sqlStatements(source: string): string[] {
  return source
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

describeIntegration('access_tier migration preflight (requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return

  const drizzleDir = join(import.meta.dir, 'drizzle')
  const migrationFiles = readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  const priorFiles = migrationFiles.filter((name) => !name.startsWith('0006_'))
  const accessTierFile = migrationFiles.find((name) => name.startsWith('0006_'))
  if (!accessTierFile) throw new Error('migration 0006 is missing')

  let admin: Sql | undefined
  let sql: Sql | undefined

  beforeAll(async () => {
    admin = postgres(withDatabase(TEST_DB_URL, 'postgres'), { max: 1 })
    await admin.unsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE ${SCRATCH_DB}`)

    sql = postgres(withDatabase(TEST_DB_URL, SCRATCH_DB), { max: 1 })
    for (const name of priorFiles) {
      for (const statement of sqlStatements(readFileSync(join(drizzleDir, name), 'utf8'))) {
        await sql.unsafe(statement)
      }
    }
  })

  afterAll(async () => {
    await sql?.end({ timeout: 5 })
    if (admin) {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`)
      await admin.end({ timeout: 5 })
    }
  })

  function db(): Sql {
    if (!sql) throw new Error('scratch database is not open')
    return sql
  }

  async function insertComponent(values: {
    slug: string
    priceAmountMinor: number | null
    priceCurrency: string | null
    requiresPaymentForUpdate: boolean
  }) {
    await db().unsafe(
      `INSERT INTO components (
        slug, name, category, price_amount_minor, price_currency, requires_payment_for_update
      ) VALUES ($1, $2, 'tool', $3, $4, $5)`,
      [
        values.slug,
        values.slug,
        values.priceAmountMinor,
        values.priceCurrency,
        values.requiresPaymentForUpdate,
      ],
    )
  }

  function accessTierStatements(): string[] {
    return sqlStatements(readFileSync(join(drizzleDir, accessTierFile), 'utf8'))
  }

  // Mỗi statement tự commit. Nếu khối đếm đứng sau ALTER, cột sẽ còn lại
  // sau khi RAISE. Transaction bọc cả file sẽ che mất lỗi thứ tự đó.
  async function applyAccessTierMigration() {
    for (const statement of accessTierStatements()) {
      await db().unsafe(statement)
    }
  }

  test('stops on a priced free-flag row, then backfills pro and free', async () => {
    await insertComponent({
      slug: 'priced-free-flag',
      priceAmountMinor: 1000,
      priceCurrency: 'USD',
      requiresPaymentForUpdate: false,
    })

    let failed = false
    try {
      await applyAccessTierMigration()
    } catch (error) {
      failed = true
      expect(errorMessage(error)).toContain(
        '1 rows have a price but requires_payment_for_update = false',
      )
    }
    expect(failed).toBe(true)

    const columnsBefore = await db()`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'components'
        AND column_name = 'access_tier'
    `
    expect(columnsBefore).toHaveLength(0)

    await db().unsafe(`DELETE FROM components WHERE slug = 'priced-free-flag'`)

    await insertComponent({
      slug: 'paid-row',
      priceAmountMinor: 1000,
      priceCurrency: 'USD',
      requiresPaymentForUpdate: true,
    })
    await insertComponent({
      slug: 'free-row',
      priceAmountMinor: null,
      priceCurrency: null,
      requiresPaymentForUpdate: false,
    })

    await applyAccessTierMigration()

    const rows = await db()`
      SELECT slug, access_tier
      FROM components
      WHERE slug IN ('paid-row', 'free-row')
      ORDER BY slug
    `
    expect(rows).toEqual([
      { slug: 'free-row', access_tier: 'free' },
      { slug: 'paid-row', access_tier: 'pro' },
    ])
  })
})
