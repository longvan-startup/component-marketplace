/**
 * Component release constraints — a fresh Postgres database applies the full
 * migration journal before checking release and file invariants.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres, { type Sql } from 'postgres'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip
const SCRATCH_DB = `cm_release_${randomUUID().replaceAll('-', '')}`

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

function postgresCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code)
  }
  return undefined
}

describeIntegration('component release migration (requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return

  const drizzleDir = join(import.meta.dir, 'drizzle')
  const migrationFiles = readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()

  let admin: Sql | undefined
  let sql: Sql | undefined

  beforeAll(async () => {
    admin = postgres(withDatabase(TEST_DB_URL, 'postgres'), { max: 1 })
    await admin.unsafe(`CREATE DATABASE ${SCRATCH_DB}`)

    sql = postgres(withDatabase(TEST_DB_URL, SCRATCH_DB), { max: 1 })
    for (const name of migrationFiles) {
      const statements = sqlStatements(readFileSync(join(drizzleDir, name), 'utf8'))
      await sql.begin(async (transaction) => {
        for (const statement of statements) {
          await transaction.unsafe(statement)
        }
      })
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

  async function insertComponent(slug: string): Promise<string> {
    const rows = await db().unsafe(
      `INSERT INTO components (slug, name, category)
       VALUES ($1, $1, 'tool')
       RETURNING id`,
      [slug],
    )
    const id = rows[0]?.id
    if (typeof id !== 'string') throw new Error('component insert returned no id')
    return id
  }

  async function insertRelease(componentId: string, version: string): Promise<string> {
    const rows = await db().unsafe(
      `INSERT INTO component_releases (component_id, version)
       VALUES ($1, $2)
       RETURNING id`,
      [componentId, version],
    )
    const id = rows[0]?.id
    if (typeof id !== 'string') throw new Error('release insert returned no id')
    return id
  }

  async function expectSqlState(operation: () => Promise<unknown>, expectedCode: string) {
    let caught: unknown
    try {
      await operation()
    } catch (error) {
      caught = error
    }
    expect(postgresCode(caught)).toBe(expectedCode)
  }

  test('enforces unique component versions and safe release file metadata', async () => {
    const componentId = await insertComponent('release-ledger-component')
    const otherComponentId = await insertComponent('release-ledger-other')
    const releaseId = await insertRelease(componentId, '1.2.3')

    await expectSqlState(() => insertRelease(componentId, '1.2.3'), '23505')
    await expect(insertRelease(componentId, '1.2.4')).resolves.toBeTruthy()
    await expect(insertRelease(otherComponentId, '1.2.3')).resolves.toBeTruthy()

    const checksum = 'a'.repeat(64)
    await db().unsafe(
      `INSERT INTO component_release_files (release_id, path, checksum_sha256)
       VALUES ($1, $2, $3)`,
      [releaseId, 'src/index.tsx', checksum],
    )

    await expectSqlState(
      () =>
        db().unsafe(
          `INSERT INTO component_release_files (release_id, path, checksum_sha256)
           VALUES ($1, $2, $3)`,
          [releaseId, 'src/index.tsx', checksum],
        ),
      '23505',
    )
    await expectSqlState(
      () =>
        db().unsafe(
          `INSERT INTO component_release_files (release_id, path, checksum_sha256)
           VALUES ($1, $2, $3)`,
          [releaseId, '', checksum],
        ),
      '23514',
    )
    await expectSqlState(
      () =>
        db().unsafe(
          `INSERT INTO component_release_files (release_id, path, checksum_sha256)
           VALUES ($1, $2, $3)`,
          [releaseId, '../outside.tsx', checksum],
        ),
      '23514',
    )
    await expectSqlState(
      () =>
        db().unsafe(
          `INSERT INTO component_release_files (release_id, path, checksum_sha256)
           VALUES ($1, $2, $3)`,
          [releaseId, 'src/bad.tsx', 'not-a-sha256'],
        ),
      '23514',
    )
  })
})
