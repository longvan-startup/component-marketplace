import { Fragment } from 'react'

/* Splits a line into words, and each word into one inline-block span per letter,
   so every letter can move on its own (see HeroText). A word never breaks across
   lines, the spaces stay real text between words, and screen readers get each
   word whole. */
export function Words({ children }: { children: string }) {
  return children.split(' ').map((word, index) => {
    // NFC keeps a Vietnamese letter and its marks together as one character.
    const letters = Array.from(word.normalize('NFC'), (char, position) => ({
      char,
      id: `${position}-${char}`,
    }))
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: the words never reorder
      <Fragment key={index}>
        {index > 0 ? ' ' : null}
        <span className="relative inline-block whitespace-nowrap">
          <span className="sr-only select-none">{word}</span>
          <span aria-hidden="true">
            {letters.map((letter) => (
              <span key={letter.id} data-letter className="inline-block">
                {letter.char}
              </span>
            ))}
          </span>
        </span>
      </Fragment>
    )
  })
}
