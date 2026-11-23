import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
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

/** A release-ledger path and the SHA-256 digest of its tracked bytes. */
export interface RegistryReleaseFileRecord {
  path: string
  checksumSha256: string
}

/** Deliberately generic so filesystem paths and file contents never reach the client. */
export class RegistryReleaseIntegrityError extends Error {
  constructor() {
    super('Registry release integrity check failed')
    this.name = 'RegistryReleaseIntegrityError'
  }
}

/** Reads only paths listed in the release ledger and verifies raw bytes first.
 *
 * @param registryRoot Directory containing component release source folders.
 * @param slug Validated component slug.
 * @param version Exact release version selected from the component row.
 * @param releaseFiles Paths and expected checksums read from the release ledger.
 * @returns Validated text files in deterministic path order.
 * @throws {RegistryReleaseIntegrityError} When a path, file, checksum, or content is invalid.
 */
export async function readRegistryReleaseFiles(
  registryRoot: string,
  slug: string,
  version: string,
  releaseFiles: RegistryReleaseFileRecord[],
): Promise<RegistryFile[]> {
  if (
    !catalogSlugSchema.safeParse(slug).success ||
    !catalogVersionSchema.safeParse(version).success ||
    releaseFiles.length === 0 ||
    releaseFiles.length > MAX_FILES
  ) {
    throw new RegistryReleaseIntegrityError()
  }

  const root = resolve(registryRoot)
  const releaseDir = resolve(root, slug, version)
  if (!releaseDir.startsWith(`${root}${sep}`)) {
    throw new RegistryReleaseIntegrityError()
  }

  const seenPaths = new Set<string>()
  const files: RegistryFile[] = []
  let totalBytes = 0

  try {
    const rootMetadata = await lstat(root)
    const componentMetadata = await lstat(resolve(root, slug))
    const releaseMetadata = await lstat(releaseDir)
    if (
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      !componentMetadata.isDirectory() ||
      componentMetadata.isSymbolicLink() ||
      !releaseMetadata.isDirectory() ||
      releaseMetadata.isSymbolicLink()
    ) {
      throw new RegistryReleaseIntegrityError()
    }

    const orderedFiles = [...releaseFiles].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    )

    for (const releaseFile of orderedFiles) {
      const segments = releaseFile.path.split('/')
      const parsedPath = registryFileSchema.shape.path.safeParse(releaseFile.path)
      if (
        !parsedPath.success ||
        !/^[0-9a-f]{64}$/.test(releaseFile.checksumSha256) ||
        seenPaths.has(releaseFile.path) ||
        !TEXT_FILE_EXTENSIONS.has(extensionOf(segments.at(-1) ?? ''))
      ) {
        throw new RegistryReleaseIntegrityError()
      }
      seenPaths.add(releaseFile.path)

      const absolutePath = resolve(releaseDir, ...segments)
      if (!absolutePath.startsWith(`${releaseDir}${sep}`)) {
        throw new RegistryReleaseIntegrityError()
      }

      let currentPath = releaseDir
      let fileSize = 0
      for (const [index, segment] of segments.entries()) {
        currentPath = resolve(currentPath, segment)
        const metadata = await lstat(currentPath)
        if (metadata.isSymbolicLink()) throw new RegistryReleaseIntegrityError()
        if (index === segments.length - 1) {
          if (!metadata.isFile() || metadata.size > MAX_FILE_BYTES) {
            throw new RegistryReleaseIntegrityError()
          }
          fileSize = metadata.size
          totalBytes += fileSize
          if (totalBytes > MAX_TOTAL_BYTES) throw new RegistryReleaseIntegrityError()
        } else if (!metadata.isDirectory()) {
          throw new RegistryReleaseIntegrityError()
        }
      }

      const bytes = await readFile(absolutePath)
      if (bytes.byteLength !== fileSize) {
        throw new RegistryReleaseIntegrityError()
      }

      const checksum = createHash('sha256').update(bytes).digest('hex')
      if (checksum !== releaseFile.checksumSha256) throw new RegistryReleaseIntegrityError()

      let content: string
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        throw new RegistryReleaseIntegrityError()
      }

      if (hasDisallowedControlCharacter(content)) throw new RegistryReleaseIntegrityError()

      const file = registryFileSchema.safeParse({ path: releaseFile.path, content })
      if (!file.success) throw new RegistryReleaseIntegrityError()
      files.push(file.data)
    }
  } catch (error) {
    if (error instanceof RegistryReleaseIntegrityError) throw error
    throw new RegistryReleaseIntegrityError()
  }

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
