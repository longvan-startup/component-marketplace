import { lstat, readdir, readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import {
  catalogSlugSchema,
  catalogVersionSchema,
  type RegistryFile,
  registryFileSchema,
} from '@marketplace/shared'

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.md',
  '.mjs',
  '.sass',
  '.scss',
  '.sh',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.svelte',
  '.yaml',
  '.yml',
])

const MAX_FILES = 100
const MAX_FILE_BYTES = 512 * 1024
const MAX_TOTAL_BYTES = 2 * 1024 * 1024

/** Deliberately generic: callers can return one stable API error without leaking paths. */
export class RegistrySourceUnavailableError extends Error {
  constructor() {
    super('Registry source is unavailable')
    this.name = 'RegistrySourceUnavailableError'
  }
}

/**
 * Load the immutable files for one catalog release from the checked-in
 * `registry/<slug>/<version>/` tree. Identity values are revalidated here as
 * defense in depth before they become filesystem path segments.
 *
 * @param registryRoot Absolute or relative path to the checked-in registry.
 * @param slug Validated catalog slug.
 * @param version Exact catalog release version.
 * @returns Every supported text file in deterministic path order.
 * @throws {RegistrySourceUnavailableError} If the release is missing or unsafe.
 */
export async function readRegistryFiles(
  registryRoot: string,
  slug: string,
  version: string,
): Promise<RegistryFile[]> {
  if (
    !catalogSlugSchema.safeParse(slug).success ||
    !catalogVersionSchema.safeParse(version).success
  ) {
    throw new RegistrySourceUnavailableError()
  }

  const root = resolve(registryRoot)
  const releaseDir = resolve(root, slug, version)
  if (!releaseDir.startsWith(`${root}${sep}`)) {
    throw new RegistrySourceUnavailableError()
  }

  const files: RegistryFile[] = []
  let totalBytes = 0

  const visit = async (directory: string, prefix: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.includes('\\')) {
        throw new RegistrySourceUnavailableError()
      }

      const absolutePath = resolve(directory, entry.name)
      const filePath = prefix ? `${prefix}/${entry.name}` : entry.name

      const metadata = await lstat(absolutePath)
      if (metadata.isSymbolicLink()) {
        throw new RegistrySourceUnavailableError()
      }

      if (metadata.isDirectory()) {
        await visit(absolutePath, filePath)
        continue
      }

      if (!metadata.isFile() || !TEXT_FILE_EXTENSIONS.has(extensionOf(entry.name))) {
        throw new RegistrySourceUnavailableError()
      }

      if (metadata.size > MAX_FILE_BYTES) {
        throw new RegistrySourceUnavailableError()
      }

      const bytes = await readFile(absolutePath)
      totalBytes += bytes.byteLength
      if (totalBytes > MAX_TOTAL_BYTES || files.length >= MAX_FILES) {
        throw new RegistrySourceUnavailableError()
      }

      let content: string
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        throw new RegistrySourceUnavailableError()
      }

      if (hasDisallowedControlCharacter(content)) {
        throw new RegistrySourceUnavailableError()
      }

      const file = registryFileSchema.safeParse({ path: filePath, content })
      if (!file.success) throw new RegistrySourceUnavailableError()
      files.push(file.data)
    }
  }

  try {
    const rootMetadata = await lstat(root)
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
      throw new RegistrySourceUnavailableError()
    }

    const componentDir = resolve(root, slug)
    const componentMetadata = await lstat(componentDir)
    if (!componentMetadata.isDirectory() || componentMetadata.isSymbolicLink()) {
      throw new RegistrySourceUnavailableError()
    }

    const metadata = await lstat(releaseDir)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new RegistrySourceUnavailableError()
    }
    await visit(releaseDir, '')
  } catch (error) {
    if (error instanceof RegistrySourceUnavailableError) throw error
    throw new RegistrySourceUnavailableError()
  }

  if (files.length === 0) throw new RegistrySourceUnavailableError()

  return files
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot < 0 ? '' : filename.slice(dot).toLowerCase()
}

function hasDisallowedControlCharacter(content: string): boolean {
  for (const character of content) {
    const codePoint = character.codePointAt(0)
    if (
      codePoint !== undefined &&
      ((codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) ||
        codePoint === 0x7f)
    ) {
      return true
    }
  }
  return false
}
