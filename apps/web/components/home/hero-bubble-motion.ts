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
export const SPEED_MIN = 30
export const SPEED_MAX = 50
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

/* The path a bubble follows for `totalS` seconds, one point per `stepS`. It moves
   at a constant speed, turns now and then, and reflects off the hero's edges.
   Points are the bubble's top-left corner in px, measured from the hero's
   top-left corner. */
export function driftPath(
  width: number,
  height: number,
  bubble: Bubble,
  startX: number,
  startY: number,
  totalS: number,
  stepS: number,
): { x: number; y: number }[] {
  const angle = Math.random() * Math.PI * 2
  const speed = randomBetween(SPEED_MIN, SPEED_MAX)
  let vx = Math.cos(angle) * speed
  let vy = Math.sin(angle) * speed
  let x = startX
  let y = startY
  let turnIn = randomBetween(TURN_WAIT_MIN, TURN_WAIT_MAX)
  const maxX = Math.max(0, width - bubble.size)
  const maxY = Math.max(0, height - bubble.size)
  const points: { x: number; y: number }[] = []
  for (let t = 0; t < totalS; t += stepS) {
    turnIn -= stepS
    if (turnIn <= 0) {
      const heading = Math.atan2(vy, vx) + randomBetween(-TURN_MAX, TURN_MAX)
      vx = Math.cos(heading) * speed
      vy = Math.sin(heading) * speed
      turnIn = randomBetween(TURN_WAIT_MIN, TURN_WAIT_MAX)
    }
    x += vx * stepS
    y += vy * stepS
    if (x < 0) {
      x = -x
      vx = Math.abs(vx)
    } else if (x > maxX) {
      x = 2 * maxX - x
      vx = -Math.abs(vx)
    }
    if (y < 0) {
      y = -y
      vy = Math.abs(vy)
    } else if (y > maxY) {
      y = 2 * maxY - y
      vy = -Math.abs(vy)
    }
    points.push({ x, y })
  }
  return points
}
