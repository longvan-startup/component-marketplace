'use client'

/**
 * The Luva UI lockup: the three blocks and the wordmark, split into letters so
 * each one can react to a block landing on it. The motion lives in logo-motion.ts
 * and repeats on a fixed cycle. Reduced motion leaves the lockup still.
 */
import { useRef } from 'react'
import { useGsapScope } from '../../lib/gsap'
import { playLogo } from './logo-motion'

const BLOCKS = [
  { place: 'left-0 top-[0.9em]', color: 'bg-primary-light' },
  { place: 'left-[0.45em] top-[0.45em]', color: 'bg-primary' },
  { place: 'left-[0.9em] top-0', color: 'bg-primary-dark' },
] as const

export function LogoLockup({ name }: { name: string }) {
  const scopeRef = useRef<HTMLSpanElement>(null)
  const letters = Array.from(name, (char, position) => ({ char, id: `${position}-${char}` }))

  useGsapScope(scopeRef, ({ gsap, q, qa }) => {
    const word = q<HTMLElement>('[data-logo-word]')
    if (!word) return
    playLogo(gsap, {
      blocks: qa<HTMLElement>('[data-logo-block]'),
      faces: qa<HTMLElement>('[data-logo-face]'),
      letters: qa<HTMLElement>('[data-logo-letter]'),
      word,
    })
  })

  return (
    <span ref={scopeRef} className="relative inline-flex items-center gap-[0.4em]">
      <span aria-hidden="true" className="relative z-10 block size-[1.6em] shrink-0">
        {BLOCKS.map((block) => (
          <span
            key={block.color}
            data-logo-block
            className={`absolute size-[0.7em] ${block.place}`}
          >
            <span data-logo-face className={`block size-full rounded-[0.2em] ${block.color}`} />
          </span>
        ))}
      </span>
      {/* Screen readers get the name as one word; the split letters are visual only. */}
      <span className="sr-only">{name}</span>
      <span aria-hidden="true" data-logo-word className="inline-block whitespace-nowrap">
        {letters.map((letter) => (
          <span key={letter.id} data-logo-letter className="inline-block whitespace-pre">
            {letter.char}
          </span>
        ))}
      </span>
    </span>
  )
}
