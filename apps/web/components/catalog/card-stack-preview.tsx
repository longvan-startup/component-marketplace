'use client'

/* Inspired by Bencho's MIT Card stack interaction, Copyright (c) 2026 Lorenzo Cabra.
   Site photos and branding are excluded. https://github.com/cabralorenzo/bencho */

import { type CSSProperties, useEffect, useId, useRef, useState } from 'react'
import styles from './card-stack-preview.module.css'

const CARDS = [
  {
    label: '01',
    accessibleName: 'Thẻ số 1',
    tone: '#f4f4f5',
    stackY: '8px',
    stackRotation: '-8deg',
    fanX: '-2.75rem',
    fanXWide: '-7rem',
    fanRotation: '-15deg',
  },
  {
    label: '02',
    accessibleName: 'Thẻ số 2',
    tone: '#e4e4e7',
    stackY: '4px',
    stackRotation: '-4deg',
    fanX: '-1.375rem',
    fanXWide: '-3.5rem',
    fanRotation: '-8deg',
  },
  {
    label: '03',
    accessibleName: 'Thẻ số 3',
    tone: '#d4d4d8',
    stackY: '0px',
    stackRotation: '0deg',
    fanX: '0rem',
    fanXWide: '0rem',
    fanRotation: '0deg',
  },
  {
    label: '04',
    accessibleName: 'Thẻ số 4',
    tone: '#e7e5e4',
    stackY: '-4px',
    stackRotation: '4deg',
    fanX: '1.375rem',
    fanXWide: '3.5rem',
    fanRotation: '8deg',
  },
  {
    label: '05',
    accessibleName: 'Thẻ số 5',
    tone: '#d6d3d1',
    stackY: '-8px',
    stackRotation: '8deg',
    fanX: '2.75rem',
    fanXWide: '7rem',
    fanRotation: '15deg',
  },
] as const

type CardPositionStyle = CSSProperties & {
  '--card-tone': string
  '--stack-y': string
  '--stack-rotation': string
  '--fan-x': string
  '--fan-x-wide': string
  '--fan-rotation': string
  '--layer': number
}

export function CardStackPreview({ componentName }: { componentName: string }) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const stageRef = useRef<HTMLFieldSetElement>(null)
  const titleId = useId()
  const instructionsId = useId()

  useEffect(() => {
    if (!selectedCard) return

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && stageRef.current && !stageRef.current.contains(target)) {
        setSelectedCard(null)
      }
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCard(null)
    }

    document.addEventListener('pointerdown', dismissOnOutsidePointer)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [selectedCard])

  return (
    <figure className={styles.preview} aria-labelledby={titleId}>
      <figcaption className={styles.caption}>
        <h2 id={titleId} className={styles.heading}>
          {componentName}, bản xem thử
        </h2>
        <p id={instructionsId} className={styles.instructions}>
          Rê chuột hoặc dùng Tab để xòe thẻ. Chọn một thẻ để đưa ra giữa; nhấn Escape hoặc bấm ngoài
          khung để thu lại.
        </p>
        <p className={styles.licenseNote}>
          Ảnh trên bencho.dev không thuộc giấy phép MIT nên đã được lược bỏ.
        </p>
      </figcaption>

      <fieldset
        ref={stageRef}
        className={styles.stage}
        data-selected={selectedCard !== null}
        aria-describedby={instructionsId}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setSelectedCard(null)
          }
        }}
      >
        <legend className="sr-only">Bộ thẻ tương tác</legend>
        <div className={styles.deck}>
          {CARDS.map((card, index) => {
            const cardStyle: CardPositionStyle = {
              '--card-tone': card.tone,
              '--stack-y': card.stackY,
              '--stack-rotation': card.stackRotation,
              '--fan-x': card.fanX,
              '--fan-x-wide': card.fanXWide,
              '--fan-rotation': card.fanRotation,
              '--layer': index,
            }

            return (
              <button
                key={card.label}
                type="button"
                className={styles.card}
                style={cardStyle}
                data-selected={selectedCard === card.label}
                aria-label={card.accessibleName}
                aria-pressed={selectedCard === card.label}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedCard((current) => (current === card.label ? null : card.label))
                }}
              >
                <span className={styles.cardFront} aria-hidden="true">
                  <span className={styles.cardLabel}>Thẻ {card.label}</span>
                  <span className={styles.photoPlaceholder}>Ảnh lược bỏ</span>
                  <span className={styles.cardFoot}>Card Stack</span>
                </span>
                <span className={styles.cardBack} aria-hidden="true">
                  <span className={styles.cardLabel}>Thẻ {card.label}</span>
                  <span className={styles.cardFoot}>Bản xem thử</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
    </figure>
  )
}
