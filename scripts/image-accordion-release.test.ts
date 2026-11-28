import { expect, test } from 'bun:test'
import { IMAGE_ACCORDION_RELEASE } from '../apps/api/src/catalog/register-image-accordion'
import { MOCK_COMPONENTS } from '../apps/web/mocks/components'

test('the current Image Accordion release ships the same portable source as the preview', async () => {
  const component = MOCK_COMPONENTS.find((item) => item.slug === IMAGE_ACCORDION_RELEASE.slug)
  if (!component) throw new Error('Image Accordion mock catalog item is missing.')

  const version = IMAGE_ACCORDION_RELEASE.latestVersion
  expect(component.latestVersion).toBe(version)

  const root = new URL('../', import.meta.url)
  for (const path of ['image-accordion.tsx', 'image-accordion.css']) {
    const release = Bun.file(new URL(`apps/api/registry/image-accordion/${version}/${path}`, root))
    const preview = Bun.file(new URL(`apps/web/components/catalog/${path}`, root))
    expect(await release.exists()).toBe(true)
    const source = await release.text()
    expect(source).toBe(await preview.text())
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/from ['"]next\//)
  }
})
