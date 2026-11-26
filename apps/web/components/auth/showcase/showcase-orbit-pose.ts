/**
 * Where each card sits on the orbit at a given moment. The cards circle an
 * imaginary centre (there is nothing drawn there): they are spread evenly around a
 * ring seen slightly from above, so the ones at the back are smaller, darker, higher
 * up and behind the ones at the front, and the ones at the sides turn a little toward
 * the middle. Cards are stacked by depth, so two cards swap places in the stack when
 * they are equally deep. The ring is wide enough that they are clear of each other at
 * that moment (see the test), so the swap cannot be seen as a jump. Pure maths, so the
 * server can place the cards for the first paint and the client can move them frame
 * by frame.
 */

/** How many cards circle. */
export const ORBIT_CARD_COUNT = 6
/** Width of one card in px, before it is scaled for depth. */
export const ORBIT_CARD_WIDTH = 280
/** Distance of the cards from the centre of the ring, in px (before the panel scales). */
export const ORBIT_RADIUS = 300
/** How much the ring is tilted: the front of the ring sits this much lower than the back. */
const TILT_PX = 34
const BACK_SCALE = 0.72
/* How dark the card at the very back is, 0 to 1. Cards stay opaque (a see-through card
   would show the one behind it); depth is shown by darkening instead. */
const BACK_SHADE = 0.55
/** Side cards turn toward the middle by up to this many degrees. */
const SIDE_TURN_DEG = 22

export type OrbitPose = {
  x: number
  y: number
  scale: number
  /** 0 at the front, up to BACK_SHADE at the back: how much a dark layer covers the card */
  shade: number
  rotationY: number
  zIndex: number
}

/**
 * @param index Which card, 0 to count - 1; cards are spaced evenly around the ring.
 * @param count How many cards are on the ring.
 * @param angleDeg How far the whole ring has turned; 0 puts card 0 at the front.
 * @returns The card's offset from the centre, size, darkness, turn and stacking order.
 */
export function orbitPose(index: number, count: number, angleDeg: number): OrbitPose {
  const theta = ((index / count) * 360 + angleDeg) * (Math.PI / 180)
  const side = Math.sin(theta)
  const front = Math.cos(theta)
  /* 1 at the front of the ring, 0 at the back */
  const depth = (front + 1) / 2
  return {
    x: ORBIT_RADIUS * side,
    y: TILT_PX * front,
    scale: BACK_SCALE + (1 - BACK_SCALE) * depth,
    shade: BACK_SHADE * (1 - depth),
    rotationY: -SIDE_TURN_DEG * side,
    zIndex: Math.round(depth * 100),
  }
}
