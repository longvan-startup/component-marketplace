/** Mock demo manifests. Only components listed here get a live demo. */

import type { DemoManifest } from '../features/demo/demo-manifest'

export const MOCK_DEMOS: DemoManifest[] = [
  {
    slug: 'shimmer-skeleton-block',
    src: '/runtime/shimmer-skeleton-block/index.html',
    knobs: [
      {
        key: 'duration',
        label: 'Thời gian quét',
        type: 'range',
        min: 0.5,
        max: 3,
        step: 0.1,
        default: 1.5,
      },
      {
        key: 'tone',
        label: 'Tông màu',
        type: 'enum',
        options: [
          { value: 'soft', label: 'Mềm' },
          { value: 'strong', label: 'Đậm' },
        ],
        default: 'soft',
      },
    ],
  },
  {
    slug: 'image-accordion',
    src: '/runtime/image-accordion',
    knobs: [
      { key: 'open', label: 'Open', type: 'range', min: 20, max: 80, step: 1, default: 50 },
      { key: 'reach', label: 'Reach', type: 'range', min: 0, max: 100, step: 1, default: 35 },
      { key: 'bounce', label: 'Bounce', type: 'range', min: 0, max: 20, step: 1, default: 10 },
      { key: 'gap', label: 'Gap (px)', type: 'range', min: 0, max: 20, step: 1, default: 8 },
    ],
  },
]
