'use client'

import { type CSSProperties, type KeyboardEvent, useRef, useState } from 'react'
import './image-accordion.css'

/** A panel's label, image URL and accessible description. */
export interface ImageAccordionItem {
  id?: string
  name: string
  src: string
  alt: string
}

/** Gallery content and tuning controls. */
export interface ImageAccordionProps {
  items: readonly ImageAccordionItem[]
  open?: number
  reach?: number
  bounce?: number
  gap?: number
  prompt?: string
  countLabel?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function panelWeights(count: number, activeIndex: number | null, open: number, reach: number) {
  const weights = Array.from({ length: count }, () => 1)
  if (activeIndex === null || count < 2) return weights

  const spread = clamp(reach, 0, 100) / 100
  for (let index = 0; index < count; index += 1) {
    const distance = Math.abs(index - activeIndex)
    if (distance === 1) weights[index] = 1 + spread * 0.22
    if (distance === 2) weights[index] = 1 + spread * 0.08
  }
  const openRatio = clamp(open, 20, 80) / 100
  const otherWeight = weights.reduce(
    (total, weight, index) => (index === activeIndex ? total : total + weight),
    0,
  )
  weights[activeIndex] = (openRatio * otherWeight) / (1 - openRatio)
  return weights
}

/** Displays a responsive photo gallery with pointer and keyboard exploration. */
export function ImageAccordion({
  items,
  open = 50,
  reach = 35,
  bounce = 10,
  gap = 8,
  prompt = 'Hover or select an image',
  countLabel = 'images',
}: ImageAccordionProps) {
  const panelRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const selected = hovered ?? focused ?? pinned
  const activeIndex = selected !== null && items[selected] ? selected : null
  const weights = panelWeights(items.length, activeIndex, open, reach)
  const transition = `cubic-bezier(0.23, 1, 0.32, ${1 + clamp(bounce, 0, 20) / 40})`

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const previous = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    if (!previous && !next && event.key !== 'Home' && event.key !== 'End') return

    event.preventDefault()
    setHovered(null)
    const targetIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (next ? 1 : -1) + items.length) % items.length
    panelRefs.current[targetIndex]?.focus()
  }

  if (items.length === 0) return null

  return (
    <div className="luva-image-accordion" onPointerLeave={() => setHovered(null)}>
      <div className="luva-image-accordion__panels" style={{ gap: clamp(gap, 0, 20) }}>
        {items.map((item, index) => (
          <button
            key={item.id ?? item.name}
            ref={(node) => {
              panelRefs.current[index] = node
            }}
            type="button"
            aria-label={item.name}
            aria-expanded={activeIndex === index}
            className="luva-image-accordion__panel"
            style={{ '--panel-easing': transition, flexGrow: weights[index] } as CSSProperties}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setHovered(index)
            }}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) setFocused(index)
            }}
            onBlur={() => setFocused(null)}
            onClick={() => {
              setHovered(null)
              if (pinned === index) setFocused(null)
              setPinned(pinned === index ? null : index)
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <img className="luva-image-accordion__image" src={item.src} alt={item.alt} />
          </button>
        ))}
      </div>
      <div className="luva-image-accordion__caption">
        <span className="luva-image-accordion__label" aria-live="polite">
          {activeIndex === null ? prompt : items[activeIndex]?.name}
        </span>
        <span className="luva-image-accordion__count">
          {activeIndex === null
            ? `${items.length} ${countLabel}`
            : `${activeIndex + 1} / ${items.length}`}
        </span>
      </div>
    </div>
  )
}
