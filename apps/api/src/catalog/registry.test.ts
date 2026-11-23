import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RegistryReleaseIntegrityError, readRegistryReleaseFiles } from './registry'

let root: string | undefined

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function makeRelease(): Promise<{ registryRoot: string; releaseDir: string }> {
  root = await mkdtemp(join(tmpdir(), 'marketplace-registry-'))
  const releaseDir = join(root, 'hero-section', '1.2.3')
  await mkdir(releaseDir, { recursive: true })
  return { registryRoot: root, releaseDir }
}

function checksum(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('readRegistryReleaseFiles', () => {
  test('reads only ledger paths in deterministic order and verifies their bytes', async () => {
    const { registryRoot, releaseDir } = await makeRelease()
    const source = 'export const Hero = () => null\n'
    const styles = '.hero { display: grid; }\n'
    await writeFile(join(releaseDir, 'index.tsx'), source)
    await writeFile(join(releaseDir, 'styles.css'), styles)
    await writeFile(join(releaseDir, 'unlisted.tsx'), 'must not be returned')

    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'styles.css', checksumSha256: checksum(styles) },
        { path: 'index.tsx', checksumSha256: checksum(source) },
      ]),
    ).resolves.toEqual([
      { path: 'index.tsx', content: source },
      { path: 'styles.css', content: styles },
    ])
  })

  test('rejects a missing release or a missing ledger file', async () => {
    const { registryRoot } = await makeRelease()
    const file = 'export const Hero = () => null\n'

    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', []),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '9.9.9', [
        { path: 'index.tsx', checksumSha256: checksum(file) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)

    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'index.tsx', checksumSha256: checksum(file) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
  })

  test('rejects unsafe identifiers, paths, and checksums', async () => {
    const { registryRoot } = await makeRelease()
    const file = 'not returned'
    const validFile = { path: 'index.tsx', checksumSha256: checksum(file) }

    await expect(
      readRegistryReleaseFiles(registryRoot, '../secret', '1.2.3', [validFile]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '../secret', [validFile]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: '../secret.tsx', checksumSha256: checksum(file) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'index.tsx', checksumSha256: 'not-a-checksum' },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
  })

  test('rejects symlinks and unsupported binary files', async () => {
    const { registryRoot, releaseDir } = await makeRelease()
    const outsideFile = join(registryRoot, 'outside.tsx')
    const content = 'must not be returned'
    await writeFile(outsideFile, content)
    await symlink(outsideFile, join(releaseDir, 'linked.tsx'))

    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'linked.tsx', checksumSha256: checksum(content) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)

    await writeFile(join(releaseDir, 'asset.png'), Buffer.from([0, 1, 2]))
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'asset.png', checksumSha256: checksum(Buffer.from([0, 1, 2])) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
  })

  test('rejects checksum mismatches, invalid UTF-8, and oversized files', async () => {
    const { registryRoot, releaseDir } = await makeRelease()
    const content = 'integrity failure must not be returned'
    await writeFile(join(releaseDir, 'index.tsx'), content)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'index.tsx', checksumSha256: '0'.repeat(64) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)

    const invalidUtf8 = Buffer.from([0xff, 0xfe])
    await writeFile(join(releaseDir, 'index.tsx'), invalidUtf8)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'index.tsx', checksumSha256: checksum(invalidUtf8) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)

    const oversized = 'x'.repeat(512 * 1024 + 1)
    await writeFile(join(releaseDir, 'index.tsx'), oversized)
    await expect(
      readRegistryReleaseFiles(registryRoot, 'hero-section', '1.2.3', [
        { path: 'index.tsx', checksumSha256: checksum(oversized) },
      ]),
    ).rejects.toBeInstanceOf(RegistryReleaseIntegrityError)
  })
})
