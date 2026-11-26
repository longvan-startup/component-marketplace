import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ImageAccordionPlayground } from '@/components/catalog/image-accordion-playground'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  CATEGORY_LABEL,
  CATEGORY_VARIANT,
  STATUS_LABEL,
  TIER_LABEL,
  tierVariant,
} from '@/features/catalog/catalog-labels'
import { getCatalogRegistryRelease } from '@/features/catalog/catalog-registry-release'
import { getCatalogSource, resolveApiMode } from '@/features/catalog/catalog-source'
import { getImageAccordionSamples } from '@/features/demo/image-accordion-data'

interface ComponentDetailProps {
  params: Promise<{ slug: string }>
}

async function loadComponent(slug: string) {
  return getCatalogSource().detail(slug)
}

export async function generateMetadata({ params }: ComponentDetailProps): Promise<Metadata> {
  const { slug } = await params
  const item = await loadComponent(slug)
  if (!item) return { title: 'Component not found' }
  return {
    title: `${item.name} — component`,
    description: item.summary,
  }
}

export const revalidate = 60
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export default async function ComponentDetailPage({ params }: ComponentDetailProps) {
  const { slug } = await params
  const item = await loadComponent(slug)
  if (!item) notFound()

  const isImageAccordion = item.slug === 'image-accordion'
  const sourceMode = resolveApiMode()
  const useNarutoSamples =
    isImageAccordion && process.env.NODE_ENV !== 'production' && sourceMode === 'mock'
  const release = isImageAccordion ? await getCatalogRegistryRelease(item) : null

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">/{item.slug}</p>
          <p className="mt-3 max-w-2xl text-base leading-6">{item.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={CATEGORY_VARIANT}>{CATEGORY_LABEL[item.category]}</Badge>
          {item.accessTier ? (
            <Badge variant={tierVariant(item.accessTier)}>{TIER_LABEL[item.accessTier]}</Badge>
          ) : null}
          {item.isPublished ? <Badge variant="success">{STATUS_LABEL.published}</Badge> : null}
          <span className="font-mono text-xs text-muted-foreground">v{item.latestVersion}</span>
        </div>
      </header>

      {isImageAccordion ? (
        <ImageAccordionPlayground
          samples={getImageAccordionSamples(useNarutoSamples)}
          release={release}
          version={item.latestVersion}
          sourceMode={sourceMode}
          useNarutoSamples={useNarutoSamples}
        />
      ) : null}

      <Card className="flex flex-col gap-4 p-6">
        <p className="text-sm leading-6">{item.description}</p>
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-badge bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Author</dt>
            <dd className="mt-1">@{item.author}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Latest version</dt>
            <dd className="mt-1 font-mono">{item.latestVersion}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Category</dt>
            <dd className="mt-1">{item.category}</dd>
          </div>
        </dl>
      </Card>
    </section>
  )
}
