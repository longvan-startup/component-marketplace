import { getImageAccordionSamples } from '../../../features/demo/image-accordion-data'
import { ImageAccordionRuntime } from '../../../features/demo/image-accordion-runtime'

export default function ImageAccordionRuntimePage() {
  return <ImageAccordionRuntime items={getImageAccordionSamples()} />
}
