import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImageAccordion } from './image-accordion'

test('Image Accordion renders no markup when items are empty', () => {
  const markup = renderToStaticMarkup(createElement(ImageAccordion, { items: [] }))
  expect(markup).toBe('')
})
