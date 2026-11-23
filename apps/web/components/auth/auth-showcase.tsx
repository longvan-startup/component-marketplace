/**
 * AuthShowcase — Figma "Showcase" (154:6097): dark panel with a seam fade,
 * moving blurred bubbles and a field of dots that dent under the mouse (both
 * shared with the home hero), a fanned cluster of three
 * component cards and a headline. Purely decorative, so it is hidden from
 * assistive tech and below `lg`.
 */
import Image from 'next/image'
import { HeroBubbles } from '../home/hero-bubbles'
import { HeroDotField } from '../home/hero-dot-field'
import { ShowcaseCopy } from './showcase-copy'

const CARDS = [
  {
    title: 'Copyable Slug Field',
    author: 'long',
    image: '/auth/showcase-1.jpg',
    position: 'left-[2px] top-[76px] rotate-[7deg]',
  },
  {
    title: 'Version Diff Previewer',
    author: 'van',
    image: '/auth/showcase-2.jpg',
    position: 'left-[174px] top-[45px] -rotate-6',
  },
  {
    title: 'Badge Row',
    author: 'long',
    image: '/auth/showcase-3.jpg',
    position: 'left-[140px] top-0',
  },
] as const

/* As dense as the hero's halftone (a dot about every 13px, about 1.3px across), so
   the mouse presses the same number of dots. Hidden until pressed, as in the hero. */
const DOT_PRESS_GRID = { spacing: 13, offset: 6.5, radius: 1.3 }

export function AuthShowcase() {
  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-foreground lg:block">
      <div className="absolute inset-y-0 left-0 w-[220px] bg-gradient-to-r from-white/[0.18] to-transparent" />
      {/* The same moving bubbles and pressable dots as the home hero: the dots stay
          hidden until the mouse presses them. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
        <HeroBubbles />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <HeroDotField color="--color-violet-300" grid={DOT_PRESS_GRID} />
      </div>

      <div className="relative flex h-full min-h-screen flex-col items-center justify-center gap-5">
        <div className="relative h-[420px] w-[560px] shrink-0 scale-75 xl:scale-100">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className={`absolute w-[280px] overflow-hidden rounded-card border border-border bg-muted shadow-[0_24px_48px_-8px_rgba(0,0,0,0.4)] ${card.position}`}
            >
              <div className="relative h-40 w-full">
                {/* Public file. /_next/image currently 404s on this deployment. */}
                <Image
                  src={card.image}
                  alt=""
                  width={280}
                  height={160}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center text-xs text-muted-foreground">
                  ⤢
                </span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
                <p className="text-base font-semibold leading-[22px] text-foreground">
                  {card.title}
                </p>
                <p className="text-sm leading-5 text-muted-foreground">by {card.author}</p>
                <div className="flex items-center gap-2 pt-2 text-xs font-medium leading-4">
                  <span className="rounded-badge bg-card px-2.5 py-1 text-muted-foreground">
                    UI Kit
                  </span>
                  <span className="rounded-badge bg-accent px-2.5 py-1 text-accent-foreground">
                    Miễn phí
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ShowcaseCopy />
      </div>
    </aside>
  )
}
