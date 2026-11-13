'use client'

import { useState } from 'react'

const CARDS = [
  { id: 'violet', label: '01', className: 'bg-primary text-primary-foreground' },
  { id: 'ink', label: '02', className: 'bg-foreground text-background' },
  { id: 'sand', label: '03', className: 'bg-accent text-accent-foreground' },
] as const

const REST = [
  'translate-x-0 rotate-[-8deg]',
  'translate-x-3 rotate-[4deg]',
  'translate-x-6 rotate-[10deg]',
] as const

/**
 * Colored stand-in for a card stack. The picture is not stored in the
 * database; only this slug's detail page draws it.
 */
export function CardStackPreview({ componentName }: { componentName: string }) {
  const [front, setFront] = useState<string>(CARDS[0].id)

  return (
    <figure
      aria-label={`${componentName} card stack preview`}
      className="flex min-h-64 items-center justify-center rounded-card border border-border bg-muted p-8"
    >
      <div className="group relative h-40 w-56">
        {CARDS.map((card, index) => {
          const isFront = card.id === front
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={isFront}
              onClick={() => setFront(card.id)}
              className={`absolute left-6 top-4 h-32 w-24 rounded-card border border-background/40 shadow-md motion-safe:transition-transform motion-safe:duration-300 ${card.className} ${
                isFront ? 'z-20 translate-y-[-18px] rotate-0' : `z-10 ${REST[index]}`
              } group-hover:translate-y-0 ${
                index === 0 ? 'group-hover:translate-x-[-28px] group-hover:rotate-[-14deg]' : ''
              } ${index === 1 ? 'group-hover:translate-x-0 group-hover:rotate-0' : ''} ${
                index === 2 ? 'group-hover:translate-x-8 group-hover:rotate-[14deg]' : ''
              }`}
            >
              <span className="block px-2 pt-2 text-left font-mono text-xs">{card.label}</span>
            </button>
          )
        })}
      </div>
    </figure>
  )
}
