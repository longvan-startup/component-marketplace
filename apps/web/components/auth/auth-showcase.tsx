/**
 * AuthShowcase — Figma "Showcase" (154:6097): dark panel with a seam fade,
 * three blurred primary blobs, a 40px dot grid, a fanned cluster of three
 * component cards and a headline. Purely decorative, so it is hidden from
 * assistive tech and below `lg`.
 */
import Image from 'next/image'

const CARDS = [
  {
    title: 'Copyable Slug Field',
    author: 'long',
    image: '/auth/showcase-1.png',
    position: 'left-[2px] top-[76px] rotate-[7deg]',
  },
  {
    title: 'Version Diff Previewer',
    author: 'van',
    image: '/auth/showcase-2.png',
    position: 'left-[174px] top-[45px] -rotate-6',
  },
  {
    title: 'Badge Row',
    author: 'long',
    image: '/auth/showcase-3.png',
    position: 'left-[140px] top-0',
  },
] as const

const DOT_GRID = {
  backgroundImage: 'radial-gradient(circle, rgb(255 255 255 / 0.08) 1.25px, transparent 1.25px)',
  backgroundSize: '40px 40px',
}

export function AuthShowcase({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-foreground lg:block">
      <div className="absolute inset-y-0 left-0 w-[220px] bg-gradient-to-r from-white/[0.18] to-transparent" />
      <div className="absolute left-[54px] top-5 size-[420px] rounded-full bg-primary opacity-35 blur-[70px]" />
      <div className="absolute left-[480px] top-[418px] size-[360px] rounded-full bg-primary opacity-[0.22] blur-[60px]" />
      <div className="absolute left-0.5 top-[606px] size-[260px] rounded-full bg-primary opacity-[0.16] blur-[50px]" />
      <div className="absolute inset-0" style={DOT_GRID} />

      <div className="relative flex h-full min-h-screen flex-col items-center justify-center gap-5">
        <div className="relative h-[420px] w-[560px] shrink-0 scale-75 xl:scale-100">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className={`absolute w-[280px] overflow-hidden rounded-card border border-border bg-muted shadow-[0_24px_48px_-8px_rgba(0,0,0,0.4)] ${card.position}`}
            >
              <div className="relative h-40 w-full">
                <Image
                  src={card.image}
                  alt=""
                  width={280}
                  height={160}
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
        <div className="flex w-[420px] max-w-full flex-col items-center gap-3 px-4 text-center text-white">
          <p className="text-3xl font-bold">{title}</p>
          <p className="max-w-[380px] text-[15px] opacity-60">{subtitle}</p>
        </div>
      </div>
    </aside>
  )
}
