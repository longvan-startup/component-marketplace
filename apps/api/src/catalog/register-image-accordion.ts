import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Component, type Database, type NewComponent, schema } from '@marketplace/db'
import { and, eq } from 'drizzle-orm'
import { type RegistryReleaseFileRecord, readRegistryReleaseFiles } from './registry'

const { components, componentReleases, componentReleaseFiles } = schema
export const IMAGE_ACCORDION_RELEASE = {
  slug: 'image-accordion',
  name: 'Image Accordion',
  description:
    'Gallery ảnh mở rộng theo hover, click hoặc bàn phím. Thử thay ảnh từng thẻ và sao chép source React để dùng trong dự án của bạn.',
  category: 'animation',
  tags: ['gallery', 'image', 'interaction', 'responsive'],
  latestVersion: '1.0.0',
  isPublished: true,
  priceAmountMinor: null,
  priceCurrency: null,
  requiresPaymentForUpdate: false,
  accessTier: 'free',
  authorId: null,
} satisfies NewComponent

const FILES = ['LICENSE.txt', 'README.md', 'image-accordion.css', 'image-accordion.tsx']
const REGISTRY_ROOT = fileURLToPath(new URL('../../registry/', import.meta.url))
type ImageAccordionMetadata = Pick<
  Component,
  | 'name'
  | 'description'
  | 'category'
  | 'tags'
  | 'latestVersion'
  | 'isPublished'
  | 'priceAmountMinor'
  | 'priceCurrency'
  | 'requiresPaymentForUpdate'
  | 'accessTier'
  | 'authorId'
>

/** A pre-existing Image Accordion row or ledger differs from the checked-in release. */
export class ImageAccordionRegistrationConflictError extends Error {
  constructor(reason: string) {
    super(`Image Accordion registration conflict: ${reason}`)
    this.name = 'ImageAccordionRegistrationConflictError'
  }
}

function metadataConflictFields(existing: ImageAccordionMetadata): string[] {
  const expected = IMAGE_ACCORDION_RELEASE
  const conflicts: string[] = []

  if (existing.name !== expected.name) conflicts.push('name')
  if (existing.description !== (expected.description ?? null)) conflicts.push('description')
  if (existing.category !== expected.category) conflicts.push('category')
  if (
    existing.tags.length !== expected.tags.length ||
    existing.tags.some((tag, index) => tag !== expected.tags[index])
  ) {
    conflicts.push('tags')
  }
  if (existing.latestVersion !== expected.latestVersion) conflicts.push('latestVersion')
  if (existing.isPublished !== expected.isPublished) conflicts.push('isPublished')
  if (existing.priceAmountMinor !== (expected.priceAmountMinor ?? null)) {
    conflicts.push('priceAmountMinor')
  }
  if (existing.priceCurrency !== (expected.priceCurrency ?? null)) conflicts.push('priceCurrency')
  if (existing.requiresPaymentForUpdate !== (expected.requiresPaymentForUpdate ?? false)) {
    conflicts.push('requiresPaymentForUpdate')
  }
  if (existing.accessTier !== expected.accessTier) conflicts.push('accessTier')
  if (existing.authorId !== (expected.authorId ?? null)) conflicts.push('authorId')

  return conflicts
}

function releaseFileConflicts(
  expectedFiles: RegistryReleaseFileRecord[],
  registeredFiles: RegistryReleaseFileRecord[],
): string[] {
  const expectedByPath = new Map(expectedFiles.map((file) => [file.path, file.checksumSha256]))
  const registeredByPath = new Map(registeredFiles.map((file) => [file.path, file.checksumSha256]))
  const conflicts: string[] = []

  for (const file of expectedFiles) {
    const registeredChecksum = registeredByPath.get(file.path)
    if (registeredChecksum === undefined) conflicts.push(`missing file ${file.path}`)
    else if (registeredChecksum !== file.checksumSha256) {
      conflicts.push(`checksum mismatch for ${file.path}`)
    }
  }
  for (const file of registeredFiles) {
    if (!expectedByPath.has(file.path)) conflicts.push(`unexpected file ${file.path}`)
  }

  return conflicts
}

/**
 * Registers the bundled Free release in an isolated development database.
 * @param db Development database connection.
 * @returns The catalog ID, release ID, and registered version.
 * @throws If the local release is invalid or conflicts with existing metadata or checksums.
 */
export async function registerImageAccordion(db: Database) {
  const { slug, latestVersion } = IMAGE_ACCORDION_RELEASE
  const releaseFiles = await Promise.all(
    FILES.map(async (path) => {
      const bytes = await readFile(join(REGISTRY_ROOT, slug, latestVersion, path))
      return { path, checksumSha256: createHash('sha256').update(bytes).digest('hex') }
    }),
  )
  await readRegistryReleaseFiles(REGISTRY_ROOT, slug, latestVersion, releaseFiles)

  return db.transaction(async (tx) => {
    await tx
      .insert(components)
      .values(IMAGE_ACCORDION_RELEASE)
      .onConflictDoNothing({ target: components.slug })
    const [component] = await tx
      .select({
        id: components.id,
        name: components.name,
        description: components.description,
        category: components.category,
        tags: components.tags,
        latestVersion: components.latestVersion,
        isPublished: components.isPublished,
        priceAmountMinor: components.priceAmountMinor,
        priceCurrency: components.priceCurrency,
        requiresPaymentForUpdate: components.requiresPaymentForUpdate,
        accessTier: components.accessTier,
        authorId: components.authorId,
      })
      .from(components)
      .where(eq(components.slug, slug))
      .for('update')

    if (!component) {
      throw new ImageAccordionRegistrationConflictError('existing component row could not be read.')
    }
    const metadataConflicts = metadataConflictFields(component)
    if (metadataConflicts.length > 0) {
      throw new ImageAccordionRegistrationConflictError(
        `metadata differs (${metadataConflicts.join(', ')}). Existing data was not changed.`,
      )
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
      return { componentId: component.id, releaseId: created.id, version: latestVersion }
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
    if (!existing) {
      throw new ImageAccordionRegistrationConflictError(
        `release v${latestVersion} row could not be read after a duplicate insert.`,
      )
    }

    const registeredFiles = await tx
      .select({
        path: componentReleaseFiles.path,
        checksumSha256: componentReleaseFiles.checksumSha256,
      })
      .from(componentReleaseFiles)
      .where(eq(componentReleaseFiles.releaseId, existing.id))
    const fileConflicts = releaseFileConflicts(releaseFiles, registeredFiles)
    if (fileConflicts.length > 0) {
      throw new ImageAccordionRegistrationConflictError(
        `release v${latestVersion} differs from checked-in source (${fileConflicts.join('; ')}). Existing ledger was not changed; create a new release version.`,
      )
    }

    return { componentId: component.id, releaseId: existing.id, version: latestVersion }
  })
}
