import { expect, test } from 'bun:test'

test('Image Accordion 1.0.0 ships the same portable source that runs in the preview', async () => {
  const root = new URL('../', import.meta.url)
  for (const path of ['image-accordion.tsx', 'image-accordion.css']) {
    const release = Bun.file(new URL(`apps/api/registry/image-accordion/1.0.0/${path}`, root))
    const preview = Bun.file(new URL(`apps/web/components/catalog/${path}`, root))
    const source = await release.text()
    expect(source).toBe(await preview.text())
    expect(source).not.toMatch(/naruto-official|from ['"]next\//)
  }
})
