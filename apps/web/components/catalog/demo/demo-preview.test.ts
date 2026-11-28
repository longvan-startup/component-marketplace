import { expect, test } from 'bun:test'
import { shouldLoadCardDemoIframe } from './demo-preview'

test('Image Accordion catalog preview does not mount a live iframe', () => {
  expect(shouldLoadCardDemoIframe('image-accordion', true, false)).toBe(false)
})

test('other card demos still obey visibility and reduced-motion gates', () => {
  expect(shouldLoadCardDemoIframe('shimmer-skeleton-block', true, false)).toBe(true)
  expect(shouldLoadCardDemoIframe('shimmer-skeleton-block', false, false)).toBe(false)
  expect(shouldLoadCardDemoIframe('shimmer-skeleton-block', true, true)).toBe(false)
})
