import { expect, test } from 'bun:test'
import { validateImageFile } from './image-accordion-image-preview'

test('image validation accepts JPEG, PNG, and WebP up to 5 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    expect(validateImageFile({ type, size: 5 * 1024 * 1024 })).toBeNull()
  }
})

test('image validation rejects unsupported formats', () => {
  expect(validateImageFile({ type: 'image/gif', size: 1024 })).toBe('Chọn ảnh JPG, PNG hoặc WebP.')
})

test('image validation rejects files larger than 5 MB', () => {
  expect(validateImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toBe(
    'Ảnh vượt quá 5 MB.',
  )
})
