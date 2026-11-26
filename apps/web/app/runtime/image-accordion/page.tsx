import { resolveApiMode } from '../../../features/catalog/catalog-source'
import { getImageAccordionSamples } from '../../../features/demo/image-accordion-data'
import { ImageAccordionRuntime } from '../../../features/demo/image-accordion-runtime'

export default function ImageAccordionRuntimePage() {
  const useNarutoSamples = process.env.NODE_ENV !== 'production' && resolveApiMode() === 'mock'
  return <ImageAccordionRuntime items={getImageAccordionSamples(useNarutoSamples)} />
}
