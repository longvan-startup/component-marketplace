/**
 * Choreography of the logo. The three blocks leap one after another from the mark
 * onto the word and roll across it. Each landing presses its letter like a piano
 * key and tints it with the block's colour. The blocks then flip back home and a
 * colour wave runs through the word. Positions are read from the layout, so any
 * logo size works.
 */
import type { GsapScopeApi } from '../../lib/gsap'

type Gsap = GsapScopeApi['gsap']
type Timeline = ReturnType<Gsap['timeline']>
type Point = () => { x: number; y: number }

/** Seconds from one cycle to the next. */
const CYCLE_S = 6
/** Quiet time before the first cycle. */
const START_S = 1
const CROUCH_S = 0.18
const HOP_S = 0.34
const HOME_S = 0.5
const CONTACT_S = 0.06
/** Delay between a block and the one that follows it. */
const FOLLOW_S = 0.26
/** Letters the blocks land on, in order: "L", "v", "U". */
const STOPS = [0, 2, 5]
const HOME: Point = () => ({ x: 0, y: 0 })

export interface LogoParts {
  /** Outer boxes of the blocks: they travel and squash. */
  blocks: HTMLElement[]
  /** Coloured squares inside them: they roll. */
  faces: HTMLElement[]
  letters: HTMLElement[]
  word: HTMLElement
}

/* Offset from a block's resting place to the top of a letter. offset* values
   ignore transforms, so they stay correct while things are moving. */
function onLetter(block: HTMLElement, letter: HTMLElement, fontPx: number) {
  const mark = block.offsetParent as HTMLElement | null
  const homeX = (mark?.offsetLeft ?? 0) + block.offsetLeft + block.offsetWidth / 2
  const homeBottom = (mark?.offsetTop ?? 0) + block.offsetTop + block.offsetHeight
  // Capitals and ascenders are taller than the other letters.
  const tall = /[A-Zbdfhklt]/.test(letter.textContent ?? '')
  const capTop = (letter.offsetHeight - fontPx * 0.73) / 2
  const surface = letter.offsetTop + capTop + (tall ? 0 : fontPx * 0.19)
  return {
    x: letter.offsetLeft + letter.offsetWidth / 2 - homeX,
    y: surface - homeBottom,
  }
}

/* One ballistic leap: stretch on take-off, roll in the air, squash on contact. */
function hop(
  timeline: Timeline,
  block: HTMLElement,
  face: HTMLElement,
  leap: { at: number; duration: number; from: Point; to: Point; arc: number; roll: number },
) {
  const { at, duration, from, to, arc, roll } = leap
  const half = duration / 2
  timeline
    .to(block, { scaleX: 0.86, scaleY: 1.18, duration: duration * 0.3, ease: 'power1.out' }, at)
    .to(block, { x: () => to().x, duration, ease: 'none' }, at)
    .to(
      block,
      { y: () => Math.min(from().y, to().y) - arc, duration: half, ease: 'power2.out' },
      at,
    )
    .to(block, { y: () => to().y, duration: half, ease: 'power2.in' }, at + half)
    .to(block, { scaleX: 1, scaleY: 1, duration: duration * 0.3 }, at + duration * 0.35)
    .to(block, { scaleX: 0.9, scaleY: 1.12, duration: duration * 0.3 }, at + duration * 0.7)
    .to(block, { scaleX: 1.3, scaleY: 0.68, duration: CONTACT_S }, at + duration)
    .to(face, { rotation: roll, duration, ease: 'sine.inOut' }, at)
}

/* A landing: the letter sinks and takes the colour, its neighbours ripple. */
function press(
  timeline: Timeline,
  letters: HTMLElement[],
  index: number,
  at: number,
  color: string,
  fontPx: number,
) {
  const letter = letters[index]
  if (!letter) return
  timeline
    .to(letter, { y: fontPx * 0.18, scaleX: 1.16, scaleY: 0.74, color, duration: 0.07 }, at)
    .to(
      letter,
      { y: 0, scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)' },
      at + 0.07,
    )
  for (const neighbour of [letters[index - 1], letters[index + 1]]) {
    if (!neighbour) continue
    timeline
      .to(neighbour, { y: fontPx * 0.08, duration: 0.09, ease: 'sine.out' }, at + 0.05)
      .to(neighbour, { y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, at + 0.14)
  }
}

export function playLogo(gsap: Gsap, { blocks, faces, letters, word }: LogoParts): void {
  const fontPx = Number.parseFloat(getComputedStyle(word).fontSize)
  const rest = getComputedStyle(word).color
  const colors = faces.map((face) => getComputedStyle(face).backgroundColor)
  const arc = fontPx * 0.4
  const stops = STOPS.filter((index) => index < letters.length)

  gsap.set([...blocks, ...letters], { transformOrigin: '50% 100%' })
  const timeline = gsap.timeline({ repeat: -1, delay: START_S, repeatRefresh: true })

  let landed = 0
  const lastPress = new Map<number, number>()
  // The top block leads, the other two follow.
  const order = blocks.map((_, index) => index).reverse()
  order.forEach((index, place) => {
    const block = blocks[index]
    const face = faces[index]
    if (!block || !face) return
    const start = place * FOLLOW_S
    timeline.to(block, { scaleX: 1.22, scaleY: 0.72, duration: CROUCH_S, ease: 'power2.in' }, start)

    let at = start + CROUCH_S
    let from = HOME
    stops.forEach((letterIndex, step) => {
      const letter = letters[letterIndex]
      if (!letter) return
      const to: Point = () => onLetter(block, letter, fontPx)
      hop(timeline, block, face, { at, duration: HOP_S, from, to, arc, roll: (step + 1) * 90 })
      press(timeline, letters, letterIndex, at + HOP_S, colors[index] ?? rest, fontPx)
      lastPress.set(letterIndex, at + HOP_S)
      from = to
      at += HOP_S + CONTACT_S
    })

    // Flip back over the word into the mark, then wobble into shape.
    hop(timeline, block, face, { at, duration: HOME_S, from, to: HOME, arc: arc * 1.1, roll: 0 })
    landed = at + HOME_S + CONTACT_S
    timeline.to(
      block,
      { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' },
      landed,
    )
  })

  // A pressed letter keeps the tint until the last block has left it.
  for (const [index, at] of lastPress) {
    const letter = letters[index]
    if (letter) timeline.to(letter, { color: rest, duration: 0.45 }, at + 0.15)
  }

  // Closing wave: each letter lifts and flashes the brand colour in turn.
  letters.forEach((letter, index) => {
    const at = landed + 0.1 + index * 0.05
    timeline
      .to(
        letter,
        { y: -fontPx * 0.16, color: colors[1] ?? rest, duration: 0.16, ease: 'sine.out' },
        at,
      )
      .to(letter, { y: 0, color: rest, duration: 0.4, ease: 'sine.inOut' }, at + 0.16)
  })

  timeline.to({}, { duration: Math.max(0, CYCLE_S - timeline.duration()) })
}
