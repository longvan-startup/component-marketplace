import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type Database, type DatabaseHandle, schema } from '@marketplace/db'
import { eq } from 'drizzle-orm'
import {
  IMAGE_ACCORDION_RELEASE,
  ImageAccordionRegistrationConflictError,
  registerImageAccordion,
} from './register-image-accordion'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip
const ROLLBACK = new Error('Rollback Image Accordion registration test transaction')

describeIntegration('registerImageAccordion (PostgreSQL integration)', () => {
  if (!TEST_DB_URL) return

  let dbHandle: DatabaseHandle | undefined

  beforeAll(async () => {
    const dbDir = new URL('../../../../packages/db', import.meta.url).pathname
    const migrate = Bun.spawnSync({
      cmd: ['bun', 'run', 'db:migrate'],
      cwd: dbDir,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if (migrate.exitCode !== 0) throw new Error(`db:migrate failed (exit ${migrate.exitCode})`)
    dbHandle = createDbHandle(TEST_DB_URL, { connectTimeout: 10 })
  })

  afterAll(async () => {
    await dbHandle?.close()
  })

  async function withRollback<T>(run: (db: Database) => Promise<T>): Promise<T> {
    if (!dbHandle) throw new Error('TEST_DATABASE_URL did not create a database handle')
    let result: T | undefined
    try {
      await dbHandle.db.transaction(async (tx) => {
        result = await run(tx as unknown as Database)
        throw ROLLBACK
      })
    } catch (error) {
      if (error !== ROLLBACK) throw error
    }
    if (result === undefined) throw new Error('Image Accordion test transaction did not run')
    return result
  }

  test('identical metadata and checksums are a no-op on repeat registration', async () => {
    await withRollback(async (db) => {
      const existing = await db
        .select({ id: schema.components.id })
        .from(schema.components)
        .where(eq(schema.components.slug, IMAGE_ACCORDION_RELEASE.slug))
        .limit(1)
      expect(existing).toHaveLength(0)

      const first = await registerImageAccordion(db)
      const componentBefore = await db
        .select()
        .from(schema.components)
        .where(eq(schema.components.id, first.componentId))
      const releasesBefore = await db
        .select()
        .from(schema.componentReleases)
        .where(eq(schema.componentReleases.componentId, first.componentId))
      const filesBefore = await db
        .select()
        .from(schema.componentReleaseFiles)
        .where(eq(schema.componentReleaseFiles.releaseId, first.releaseId))

      const second = await registerImageAccordion(db)
      const componentAfter = await db
        .select()
        .from(schema.components)
        .where(eq(schema.components.id, first.componentId))
      const releasesAfter = await db
        .select()
        .from(schema.componentReleases)
        .where(eq(schema.componentReleases.componentId, first.componentId))
      const filesAfter = await db
        .select()
        .from(schema.componentReleaseFiles)
        .where(eq(schema.componentReleaseFiles.releaseId, first.releaseId))

      expect(second).toEqual(first)
      expect(componentAfter).toEqual(componentBefore)
      expect(releasesAfter).toEqual(releasesBefore)
      expect(filesAfter).toEqual(filesBefore)
      expect(filesAfter.length).toBeGreaterThan(0)
      return first
    })
  })

  test('metadata conflicts are explicit and never publish or alter an existing row', async () => {
    await withRollback(async (db) => {
      const conflictingMetadata = {
        ...IMAGE_ACCORDION_RELEASE,
        description: 'An existing description that must remain unchanged.',
        isPublished: false,
      }
      const [inserted] = await db
        .insert(schema.components)
        .values(conflictingMetadata)
        .returning({ id: schema.components.id })
      if (!inserted) throw new Error('Failed to create the test component row')

      const before = await db
        .select()
        .from(schema.components)
        .where(eq(schema.components.id, inserted.id))

      await expect(registerImageAccordion(db)).rejects.toBeInstanceOf(
        ImageAccordionRegistrationConflictError,
      )
      await expect(registerImageAccordion(db)).rejects.toThrow('description, isPublished')

      const after = await db
        .select()
        .from(schema.components)
        .where(eq(schema.components.id, inserted.id))
      const releases = await db
        .select()
        .from(schema.componentReleases)
        .where(eq(schema.componentReleases.componentId, inserted.id))

      expect(after).toEqual(before)
      expect(after[0]?.isPublished).toBe(false)
      expect(releases).toHaveLength(0)
      return inserted.id
    })
  })

  test('a checksum conflict identifies the file and preserves the old ledger', async () => {
    await withRollback(async (db) => {
      const [component] = await db
        .insert(schema.components)
        .values(IMAGE_ACCORDION_RELEASE)
        .returning({ id: schema.components.id })
      if (!component) throw new Error('Failed to create the test component row')

      const [release] = await db
        .insert(schema.componentReleases)
        .values({
          componentId: component.id,
          version: IMAGE_ACCORDION_RELEASE.latestVersion,
        })
        .returning({ id: schema.componentReleases.id })
      if (!release) throw new Error('Failed to create the test release row')

      await db.insert(schema.componentReleaseFiles).values({
        releaseId: release.id,
        path: 'image-accordion.tsx',
        checksumSha256: '0'.repeat(64),
      })
      const before = await db
        .select()
        .from(schema.componentReleaseFiles)
        .where(eq(schema.componentReleaseFiles.releaseId, release.id))

      await expect(registerImageAccordion(db)).rejects.toBeInstanceOf(
        ImageAccordionRegistrationConflictError,
      )
      await expect(registerImageAccordion(db)).rejects.toThrow('image-accordion.tsx')

      const after = await db
        .select()
        .from(schema.componentReleaseFiles)
        .where(eq(schema.componentReleaseFiles.releaseId, release.id))
      expect(after).toEqual(before)
      return release.id
    })
  })
})
