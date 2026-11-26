import type { ImageAccordionItem } from '../../components/catalog/image-accordion'

const NARUTO_SAMPLES: readonly ImageAccordionItem[] = [
  {
    name: 'Itachi Uchiha',
    src: 'https://naruto-official.com/special/wallpaper_gallery/wallpaper/en/123_260609_en.jpg',
    alt: 'Itachi Uchiha in the official Naruto wallpaper gallery',
  },
  {
    name: 'Deidara',
    src: 'https://naruto-official.com/special/wallpaper_gallery/wallpaper/en/118_260505_en.jpg',
    alt: 'Deidara in the official Naruto wallpaper gallery',
  },
  {
    name: 'Hidan',
    src: 'https://naruto-official.com/special/wallpaper_gallery/wallpaper/en/115_260402_en.jpg',
    alt: 'Hidan in the official Naruto wallpaper gallery',
  },
  {
    name: 'Kisame Hoshigaki',
    src: 'https://naruto-official.com/special/wallpaper_gallery/wallpaper/en/64_250318.jpg',
    alt: 'Kisame Hoshigaki in the official Naruto wallpaper gallery',
  },
  {
    name: 'Obito Uchiha',
    src: 'https://naruto-official.com/special/wallpaper_gallery/wallpaper/en/107_260210_en.jpg',
    alt: 'Obito Uchiha in the official Naruto wallpaper gallery',
  },
]

const PUBLIC_SAMPLES: readonly ImageAccordionItem[] = [
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

export function getImageAccordionSamples(useNarutoSamples: boolean): readonly ImageAccordionItem[] {
  return useNarutoSamples ? NARUTO_SAMPLES : PUBLIC_SAMPLES
}
