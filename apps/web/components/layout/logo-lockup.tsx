'use client'

/**
 * The Luva UI lockup: the three blocks and the wordmark. Each cycle the blocks
 * hop up onto the word, the word squashes and wobbles under them like jelly,
 * then the blocks hop back to the mark and everything settles. One cycle lasts
 * CYCLE_S seconds and repeats. Reduced motion skips it.
 */
import { useRef } from 'react'
import { useGsapScope } from '../../lib/gsap'

/** Seconds from one cycle to the next. */
const CYCLE_S = 6
/** Delay between neighbouring blocks, so they hop one after another. */
const STAGGER_S = 0.1
/** Tilt in degrees while airborne, per block (left, middle, right). */
const TILT_DEG = [-12, 8, -6]
/** Where each block lands along the word, as a fraction of its width. */
const LAND_AT = [0.2, 0.5, 0.8]
/** How high the hop arc rises above the landing point, in px. */
const ARC_PX = 24

export function LogoLockup({ name }: { name: string }) {
  const scopeRef = useRef<HTMLSpanElement>(null)

  useGsapScope(scopeRef, ({ gsap, q, qa }) => {
    const blocks = qa('[data-logo-block]')
    const word = q<HTMLElement>('[data-logo-word]')
    if (!word) return

    gsap.set(blocks, { transformOrigin: '50% 100%' })
    gsap.set(word, { transformOrigin: '50% 100%' })

    // Measure before any tween moves the blocks.
    const wordBox = word.getBoundingClientRect()
    const moves = blocks.map((block, index) => {
      const box = block.getBoundingClientRect()
      const targetX = wordBox.left + wordBox.width * (LAND_AT[index] ?? 0.5)
      return {
        x: targetX - (box.left + box.width / 2),
        y: wordBox.top + 2 - box.bottom,
      }
    })

    const timeline = gsap.timeline({ repeat: -1 })

    blocks.forEach((block, index) => {
      const at = index * STAGGER_S
      const { x, y } = moves[index] ?? { x: 0, y: 0 }
      const tilt = TILT_DEG[index] ?? 0
      const hopUp = { y: y - ARC_PX, rotation: tilt, scaleX: 0.88, scaleY: 1.18 }
      const squash = { scaleX: 1.22, scaleY: 0.78 }
      const settle = { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1, 0.28)' }

      // Out to the word: crouch, spring over, drop onto it.
      timeline
        .to(block, { scaleX: 1.2, scaleY: 0.7, duration: 0.15, ease: 'power1.in' }, at)
        .to(block, { x, duration: 0.55, ease: 'power1.inOut' }, at + 0.15)
        .to(block, { ...hopUp, duration: 0.25, ease: 'power2.out' }, at + 0.15)
        .to(block, { y, rotation: 0, ...squash, duration: 0.3, ease: 'power2.in' }, at + 0.4)
        .to(block, settle, at + 0.7)
        // Back: lift off the word, arc down to the mark.
        .to(block, { ...hopUp, duration: 0.25, ease: 'power2.out' }, 2.2 + at)
        .to(block, { x: 0, duration: 0.6, ease: 'power1.inOut' }, 2.2 + at)
        .to(block, { y: 0, rotation: 0, ...squash, duration: 0.35, ease: 'power2.in' }, 2.45 + at)
        .to(block, settle, 2.8 + at)
    })

    // The word takes the impact, then jiggles like jelly and settles.
    timeline
      .to(word, { scaleX: 1.06, scaleY: 0.84, duration: 0.12, ease: 'power2.out' }, 0.85)
      .to(word, { skewX: -3, duration: 0.1, ease: 'power1.out' }, 0.85)
      .to(word, { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.25)' }, 0.97)
      .to(word, { skewX: 0, duration: 1.1, ease: 'elastic.out(1, 0.25)' }, 0.95)

    // Pad the cycle so every loop starts again after CYCLE_S seconds.
    timeline.to({}, { duration: Math.max(0, CYCLE_S - timeline.duration()) })
  })

  return (
    <span ref={scopeRef} className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="relative block size-8 shrink-0">
        <span
          data-logo-block
          className="absolute left-0 top-[18px] size-3.5 rounded-[4px] bg-primary-light"
        />
        <span
          data-logo-block
          className="absolute left-[9px] top-[9px] size-3.5 rounded-[4px] bg-primary"
        />
        <span
          data-logo-block
          className="absolute left-[18px] top-0 size-3.5 rounded-[4px] bg-primary-dark"
        />
      </span>
      <span data-logo-word className="inline-block">
        {name}
      </span>
    </span>
  )
}
