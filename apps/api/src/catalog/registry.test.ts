import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RegistrySourceUnavailableError, readRegistryFiles } from './registry'

let root: string | undefined

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function makeRoot(): Promise<string> {
  root = await mkdtemp(join(tmpdir(), 'marketplace-registry-'))
  return root
}

describe('readRegistryFiles', () => {
  test('reads all supported files recursively in deterministic order', async () => {
    const registryRoot = await makeRoot()
    const releaseDir = join(registryRoot, 'hero-section', '1.2.3')
    await mkdir(join(releaseDir, 'src'), { recursive: true })
    await writeFile(join(releaseDir, 'index.tsx'), 'export const Hero = () => null\n')
    await writeFile(join(releaseDir, 'styles.css'), '.hero { display: grid; }\n')
    await writeFile(join(releaseDir, 'src', 'README.md'), 'Component source fixture\n')

    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).resolves.toEqual([
      { path: 'index.tsx', content: 'export const Hero = () => null\n' },
      { path: 'src/README.md', content: 'Component source fixture\n' },
      { path: 'styles.css', content: '.hero { display: grid; }\n' },
    ])
  })

  test('rejects a missing release without exposing the filesystem path', async () => {
    const registryRoot = await makeRoot()

    const error = await readRegistryFiles(registryRoot, 'hero-section', '9.9.9').then(
      () => null,
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(RegistrySourceUnavailableError)
    expect((error as Error).message).not.toContain(registryRoot)
  })

  test('rejects unsafe identifiers before reading the filesystem', async () => {
    const registryRoot = await makeRoot()

    await expect(readRegistryFiles(registryRoot, '../secret', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )
    await expect(
      readRegistryFiles(registryRoot, 'hero-section', '../secret'),
    ).rejects.toBeInstanceOf(RegistrySourceUnavailableError)
  })

  test('rejects symlinks and non-text files instead of following or returning them', async () => {
    const registryRoot = await makeRoot()
    const releaseDir = join(registryRoot, 'hero-section', '1.2.3')
    await mkdir(releaseDir, { recursive: true })
    const outsideFile = join(registryRoot, 'outside.tsx')
    await writeFile(outsideFile, 'must not be returned')
    await symlink(outsideFile, join(releaseDir, 'linked.tsx'))

    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )

    await rm(join(releaseDir, 'linked.tsx'))
    await writeFile(join(releaseDir, 'asset.png'), Buffer.from([0, 1, 2]))
    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )
  })

  test('rejects hidden files, invalid UTF-8, and oversized files', async () => {
    const registryRoot = await makeRoot()
    const releaseDir = join(registryRoot, 'hero-section', '1.2.3')
    await mkdir(releaseDir, { recursive: true })
    await writeFile(join(releaseDir, '.env'), 'not public')
    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )

    await rm(join(releaseDir, '.env'))
    await writeFile(join(releaseDir, 'index.tsx'), Buffer.from([0xff, 0xfe]))
    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )

    await writeFile(join(releaseDir, 'index.tsx'), 'x'.repeat(512 * 1024 + 1))
    await expect(readRegistryFiles(registryRoot, 'hero-section', '1.2.3')).rejects.toBeInstanceOf(
      RegistrySourceUnavailableError,
    )
  })
})
