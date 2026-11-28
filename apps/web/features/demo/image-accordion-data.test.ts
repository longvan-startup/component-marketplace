import { expect, test } from 'bun:test'
import { getImageAccordionSamples, IMAGE_ACCORDION_SAMPLES } from './image-accordion-data'

test('Image Accordion always uses five distinct locally served demo illustrations', () => {
  const samples = getImageAccordionSamples()

  expect(samples).toEqual(IMAGE_ACCORDION_SAMPLES)
  expect(samples).toHaveLength(5)
  expect(new Set(samples.map((sample) => sample.name)).size).toBe(5)
  expect(new Set(samples.map((sample) => sample.src)).size).toBe(5)
  for (const sample of samples) {
    expect(sample.src).toMatch(/^\/demo\/image-accordion\/[^/]+\.svg$/)
    expect(sample.alt.length).toBeGreaterThan(0)
  }
})
