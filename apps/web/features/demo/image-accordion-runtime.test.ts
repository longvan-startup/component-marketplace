import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getImageAccordionSamples } from './image-accordion-data'
import { ImageAccordionRuntime } from './image-accordion-runtime'

test('sandboxed runtime includes styles for the interactive five-panel gallery', () => {
  const html = renderToStaticMarkup(
    createElement(ImageAccordionRuntime, { items: getImageAccordionSamples() }),
  )

  expect(html.match(/<img\b/g)?.length).toBe(5)
  expect(html).toContain('<style>')
  expect(html).toContain('.luva-image-accordion__panels')
  expect(html).toContain('.luva-image-accordion__panel:focus-visible')
  expect(html).toContain('prefers-reduced-motion: reduce')
})

test('published CSS keeps its original timing while the sandbox preview uses the measured timing', async () => {
  const html = renderToStaticMarkup(
    createElement(ImageAccordionRuntime, { items: getImageAccordionSamples() }),
  )
  const css = await readFile(
    new URL('../../components/catalog/image-accordion.css', import.meta.url),
    'utf8',
  )

  expect(css).toContain('transition: flex-grow 720ms var(--panel-easing)')
  expect(html).toContain('transition: flex-grow 420ms var(--panel-easing)')
})
