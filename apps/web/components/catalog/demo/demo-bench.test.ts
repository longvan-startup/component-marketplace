import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MOCK_DEMOS } from '../../../mocks/demos'
import { DemoBench } from './demo-bench'

test('Bench iframe has an explicit mobile height', () => {
  const demo = MOCK_DEMOS[0]
  if (!demo) throw new Error('Expected a demo manifest')

  const html = renderToStaticMarkup(
    createElement(DemoBench, {
      demo,
      name: 'Shimmer Skeleton Block',
      originRef: { current: null },
      onClose: () => {},
    }),
  )

  expect(html).toMatch(/class="relative h-\[320px\] [^"]*"/)
})
