import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Database, type NewComponent, schema } from '@marketplace/db'
import { and, eq } from 'drizzle-orm'
import { readRegistryReleaseFiles } from './registry'

const { components, componentReleases, componentReleaseFiles } = schema
const RELEASE = {
  slug: 'image-accordion',
  name: 'Image Accordion',
  description:
    'Gallery ảnh mở rộng theo hover, click hoặc bàn phím. Thử thay ảnh từng thẻ và sao chép source React để dùng trong dự án của bạn.',
  category: 'animation',
  tags: ['gallery', 'image', 'interaction', 'responsive'],
  latestVersion: '1.0.0',
  isPublished: true,
  accessTier: 'free',
} satisfies NewComponent

const FILES = ['LICENSE.txt', 'README.md', 'image-accordion.css', 'image-accordion.tsx']
const REGISTRY_ROOT = fileURLToPath(new URL('../../registry/', import.meta.url))

/**
 * Registers the bundled Free release in an isolated development database.
 * @param db Development database connection.
 * @returns The catalog and release IDs.
 * @throws If the local release is invalid or conflicts with an existing version.
 */
export async function registerImageAccordion(db: Database) {
  const { slug, latestVersion } = RELEASE
  const releaseFiles = await Promise.all(
    FILES.map(async (path) => {
      const bytes = await readFile(join(REGISTRY_ROOT, slug, latestVersion, path))
      return { path, checksumSha256: createHash('sha256').update(bytes).digest('hex') }
    }),
  )
  await readRegistryReleaseFiles(REGISTRY_ROOT, slug, latestVersion, releaseFiles)
  const expectedChecksums = new Map(releaseFiles.map((file) => [file.path, file.checksumSha256]))

  return db.transaction(async (tx) => {
    await tx.insert(components).values(RELEASE).onConflictDoNothing({ target: components.slug })
    const [component] = await tx
      .select({
        id: components.id,
        version: components.latestVersion,
        tier: components.accessTier,
      })
      .from(components)
      .where(eq(components.slug, slug))
      .for('update')

    if (
      !component ||
      component.version !== latestVersion ||
      component.tier !== RELEASE.accessTier
    ) {
      throw new Error('Existing Image Accordion metadata conflicts with this release.')
    }

    const [created] = await tx
      .insert(componentReleases)
      .values({ componentId: component.id, version: latestVersion })
      .onConflictDoNothing({
        target: [componentReleases.componentId, componentReleases.version],
      })
      .returning({ id: componentReleases.id })

    if (created) {
      await tx
        .insert(componentReleaseFiles)
        .values(releaseFiles.map((file) => ({ ...file, releaseId: created.id })))
      return { componentId: component.id, releaseId: created.id }
    }

    const [existing] = await tx
      .select({ id: componentReleases.id })
      .from(componentReleases)
      .where(
        and(
          eq(componentReleases.componentId, component.id),
          eq(componentReleases.version, latestVersion),
        ),
      )
      .limit(1)
    if (!existing) throw new Error('Existing Image Accordion release could not be read.')

    const registeredFiles = await tx
      .select({ path: componentReleaseFiles.path, checksum: componentReleaseFiles.checksumSha256 })
      .from(componentReleaseFiles)
      .where(eq(componentReleaseFiles.releaseId, existing.id))
    if (
      registeredFiles.length !== releaseFiles.length ||
      registeredFiles.some((file) => expectedChecksums.get(file.path) !== file.checksum)
    ) {
      throw new Error('Registered Image Accordion files differ. Create a new release version.')
    }

    return { componentId: component.id, releaseId: existing.id }
  })
}
