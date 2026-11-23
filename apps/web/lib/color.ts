/**
 * Reads a hex colour token from the page's CSS and returns it as "r, g, b",
 * for canvas fills that need an rgba() string. Colours live in globals.css
 * (@theme), so canvas code reads them at runtime instead of hard-coding values.
 */
export function readTokenRgb(element: Element, token: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim()
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match?.[1]) throw new Error(`Colour token ${token} is missing or not a hex value`)
  const n = Number.parseInt(match[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
