/**
 * Catalog grid card — Server Component (no state/events). Presentational
 * only: data types + publication state decide the visuals, never page code.
 */
import Link from 'next/link'
import type { CatalogItem } from '../../features/catalog/catalog-source'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'

const CATEGORY_LABELS: Record<CatalogItem['category'], string> = {
  animation: 'animation',
  'react-component': 'component',
  tool: 'tool',
}

export function ComponentCard({ item }: { item: CatalogItem }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/components/${item.slug}`}
          className="font-semibold tracking-tight hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.name}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">v{item.latestVersion}</span>
      </div>

      <p className="text-sm text-muted-foreground">{item.summary}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Badge variant={item.category === 'animation' ? 'brand' : 'neutral'}>
          {CATEGORY_LABELS[item.category]}
        </Badge>
        {item.isPublished ? null : <Badge variant="success">preview</Badge>}
        {item.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="font-mono text-xs text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>
    </Card>
  )
}
