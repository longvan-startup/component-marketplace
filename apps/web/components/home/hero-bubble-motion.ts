/* Settings and random setup for the home hero bubbles. Pure data and helpers,
   no DOM, so the component and the drift hook can both use it. */

export type Bubble = {
  size: number
  left: number
  top: number
  color: string
  pulseDuration: number
  pulseDelay: number
  pulseMax: number
}

/* Only purple tones that stay visible on white. The very light #ddd6fe made
   bubbles look like they had disappeared. */
const BUBBLE_COLORS = [
  'var(--color-violet-300)',
  'var(--color-violet-400)',
  'var(--color-violet-500)',
] as const
export const BUBBLE_COUNT = 5

/* Ping-pong motion: each bubble keeps its own constant speed, bounces off the
   hero's edges, and now and then turns to a new random heading. */
export const SPEED_MIN = 12
export const SPEED_MAX = 22
export const TURN_WAIT_MIN = 1.5
export const TURN_WAIT_MAX = 4.5
/* largest turn in one step, in radians (about 80 degrees) */
export const TURN_MAX = 1.4

export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

/* Each bubble gets its own random size, colour and rhythm, and starts in its
   own column across the width. It is built after mount, so the server and
   client markup never disagree. */
export function makeBubbles(): Bubble[] {
  const slot = 100 / BUBBLE_COUNT
  return Array.from({ length: BUBBLE_COUNT }, (_, index) => ({
    size: randomBetween(160, 260),
    left: index * slot + randomBetween(0, slot * 0.6) - slot * 0.3,
    top: randomBetween(-10, 75),
    color:
      BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] ?? 'var(--color-violet-400)',
    /* swell and shrink run on their own rhythm, independent of the drift */
    pulseDuration: randomBetween(4, 6),
    pulseDelay: -randomBetween(0, 6),
    pulseMax: Number(randomBetween(1.05, 1.15).toFixed(2)),
  }))
}
