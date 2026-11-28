import type { ImageAccordionItem } from '../../components/catalog/image-accordion'

export const IMAGE_ACCORDION_SAMPLES: readonly ImageAccordionItem[] = [
  {
    name: 'Violet Dunes',
    src: '/demo/image-accordion/violet-dunes.svg',
    alt: 'Layered violet hills beneath a pale evening sky',
  },
  {
    name: 'Amber Ridge',
    src: '/demo/image-accordion/amber-ridge.svg',
    alt: 'Golden hills under a warm sunset',
  },
  {
    name: 'Jade Valley',
    src: '/demo/image-accordion/jade-valley.svg',
    alt: 'Deep green ridges under a muted sky',
  },
  {
    name: 'Blue Horizon',
    src: '/demo/image-accordion/blue-horizon.svg',
    alt: 'Blue mountain silhouettes at dawn',
  },
  {
    name: 'Rose Canyon',
    src: '/demo/image-accordion/rose-canyon.svg',
    alt: 'Rose colored canyon cliffs in soft light',
  },
]

export function getImageAccordionSamples(): readonly ImageAccordionItem[] {
  return IMAGE_ACCORDION_SAMPLES
}
