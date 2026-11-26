/**
 * AuthShowcase — Figma "Showcase" (154:6097): dark panel with a seam fade,
 * moving blurred bubbles and a field of dots that dent under the mouse (both
 * shared with the home hero), real catalog components circling an imaginary
 * centre, and a headline. Purely decorative, so it is hidden from assistive tech,
 * ignores the pointer (apart from the dots) and is dropped below `lg`.
 */
import { CATEGORY_LABEL, TIER_LABEL, tierVariant } from '../../../features/catalog/catalog-labels'
import {
  type CatalogItem,
  createMockCatalogSource,
  getCatalogSource,
} from '../../../features/catalog/catalog-source'
import { HeroBubbles } from '../../effects/hero-bubbles'
import { HeroDotField } from '../../effects/hero-dot-field'
import { ShowcaseCopy } from './showcase-copy'
import { type OrbitCard, ShowcaseOrbit } from './showcase-orbit'
import { ORBIT_CARD_COUNT } from './showcase-orbit-pose'

/* The three artworks, handed out in turn: the catalog has no preview images yet. */
const ARTWORK = ['/auth/showcase-1.jpg', '/auth/showcase-2.jpg', '/auth/showcase-3.jpg'] as const

/* The real components, or none when the catalog cannot be read. Only when running
   locally is the mock catalog used instead, so the panel is not empty while the API
   is down; in production it never shows made-up components. */
async function loadOrbitCards(): Promise<OrbitCard[]> {
  let items: CatalogItem[] = []
  try {
    items = (await getCatalogSource().list({ pageSize: ORBIT_CARD_COUNT })).items
  } catch {
    items = []
  }
  if (items.length === 0 && process.env.NODE_ENV !== 'production') {
    items = (await createMockCatalogSource().list({ pageSize: ORBIT_CARD_COUNT })).items
  }
  if (items.length === 0) return []
  return Array.from({ length: ORBIT_CARD_COUNT }, (_, index) => {
    const item = items[index % items.length] as CatalogItem
    return {
      id: `${item.id}-${index}`,
      name: item.name,
      author: item.author,
      categoryLabel: CATEGORY_LABEL[item.category],
      tierLabel: item.accessTier ? TIER_LABEL[item.accessTier] : undefined,
      tierVariant: item.accessTier ? tierVariant(item.accessTier) : undefined,
      image: ARTWORK[index % ARTWORK.length] as string,
    }
  })
}

/* As dense as the hero's halftone (a dot about every 13px, about 1.3px across), so
   the mouse presses the same number of dots. Hidden until pressed, as in the hero. */
const DOT_PRESS_GRID = { spacing: 13, offset: 6.5, radius: 1.3 }

export async function AuthShowcase() {
  const cards = await loadOrbitCards()
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
        {cards.length > 0 ? <ShowcaseOrbit cards={cards} /> : null}
        <ShowcaseCopy />
      </div>
    </aside>
  )
}
