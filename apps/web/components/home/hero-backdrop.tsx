import { HeroBubbles } from './hero-bubbles'
import { HeroDotField } from './hero-dot-field'

/* Home hero backdrop: purple bubbles and the halftone dot field, behind the
   hero text. Both are decorative, so the whole layer is hidden from assistive
   tech and ignores the pointer. */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <HeroBubbles />
      <HeroDotField />
    </div>
  )
}
