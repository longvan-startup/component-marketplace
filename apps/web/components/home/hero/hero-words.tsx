import { Fragment } from 'react'

/* Splits a line into one inline-block span per word, so each word can move on
   its own (see HeroText). The spaces stay real text between the spans, so the
   line still wraps and reads as ordinary text. */
export function Words({ children }: { children: string }) {
  return children.split(' ').map((word, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the words never reorder
    <Fragment key={index}>
      {index > 0 ? ' ' : null}
      <span data-word className="inline-block">
        {word}
      </span>
    </Fragment>
  ))
}
