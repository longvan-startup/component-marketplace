import { describe, expect, test } from 'bun:test'
import { ORBIT_CARD_COUNT, ORBIT_CARD_WIDTH, ORBIT_RADIUS, orbitPose } from './showcase-orbit-pose'

describe('orbitPose', () => {
  test('the card at angle 0 is in front: centred, full size, not darkened, on top', () => {
    const pose = orbitPose(0, 6, 0)
    expect(pose.x).toBeCloseTo(0)
    expect(pose.scale).toBeCloseTo(1)
    expect(pose.shade).toBeCloseTo(0)
    expect(pose.zIndex).toBe(100)
    expect(pose.rotationY).toBeCloseTo(0)
  })

  test('the card opposite the front is at the back: smaller, darker, higher and under the rest', () => {
    const front = orbitPose(0, 6, 0)
    const back = orbitPose(3, 6, 0)
    expect(back.scale).toBeLessThan(front.scale)
    expect(back.shade).toBeGreaterThan(front.shade)
    expect(back.y).toBeLessThan(front.y)
    expect(back.zIndex).toBeLessThan(front.zIndex)
  })

  test('a quarter turn puts a card at the side, at the full radius, turned toward the middle', () => {
    const right = orbitPose(0, 4, 90)
    expect(right.x).toBeCloseTo(ORBIT_RADIUS)
    expect(right.rotationY).toBeLessThan(0)
    const left = orbitPose(0, 4, 270)
    expect(left.x).toBeCloseTo(-ORBIT_RADIUS)
    expect(left.rotationY).toBeGreaterThan(0)
  })

  test('a full turn comes back to where it started', () => {
    const start = orbitPose(2, 5, 0)
    const end = orbitPose(2, 5, 360)
    expect(end.x).toBeCloseTo(start.x)
    expect(end.y).toBeCloseTo(start.y)
    expect(end.zIndex).toBe(start.zIndex)
  })

  test('two cards are clear of each other at the moment they trade places in the stack', () => {
    /* Cards are stacked by depth. When two are exactly as deep as each other, the one
       moving to the front goes on top. If they overlapped then, that card would seem
       to jump over the other, so they must be clear of each other at that instant. */
    const count = ORBIT_CARD_COUNT
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let previous = orbitPose(i, count, 0).zIndex - orbitPose(j, count, 0).zIndex
        for (let angle = 0.25; angle <= 360; angle += 0.25) {
          const a = orbitPose(i, count, angle)
          const b = orbitPose(j, count, angle)
          const difference = a.zIndex - b.zIndex
          if (previous !== 0 && difference !== 0 && Math.sign(previous) !== Math.sign(difference)) {
            const gap = Math.abs(a.x - b.x)
            const widest = ORBIT_CARD_WIDTH * Math.max(a.scale, b.scale)
            expect(gap).toBeGreaterThanOrEqual(widest)
          }
          if (difference !== 0) previous = difference
        }
      }
    }
  })
})
