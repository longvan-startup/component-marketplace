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
]
