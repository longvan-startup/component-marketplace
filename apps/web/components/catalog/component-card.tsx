/**
 * Catalog card — Server Component (no state of its own). Shows only what the
 * owner chose for the card: the live demo, name, tags, tier and author. Version
 * and summary live on the detail page. Used by both the home page and the catalog.
 */
import Link from 'next/link'
import { TIER_LABEL, tierVariant } from '../../features/catalog/catalog-labels'
import type { CatalogItem } from '../../features/catalog/catalog-source'
import type { DemoManifest } from '../../features/demo/demo-manifest'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'
import { DemoPreview } from './demo/demo-preview'

export function ComponentCard({
  item,
  demo = null,
}: {
  item: CatalogItem
  demo?: DemoManifest | null
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <DemoPreview demo={demo} name={item.name} summary={item.summary} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Link
          href={`/components/${item.slug}`}
          className="inline-flex min-h-11 items-center font-semibold tracking-tight hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.name}
        </Link>
        <p className="text-sm text-muted-foreground">by {item.author}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {item.accessTier ? (
            <Badge variant={tierVariant(item.accessTier)}>{TIER_LABEL[item.accessTier]}</Badge>
          ) : null}
          {item.isPublished ? null : <Badge variant="neutral">Bản nháp</Badge>}
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="font-mono text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
