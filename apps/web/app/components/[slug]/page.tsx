import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PreviewPanel } from '@/components/catalog/preview-panel'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getCatalogSource } from '@/features/catalog/catalog-source'

interface ComponentDetailProps {
  params: Promise<{ slug: string }>
}

async function loadComponent(slug: string) {
  const source = getCatalogSource()
  return source.detail(slug)
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

/* Component detail — Server Component. Unknown/unpublished slugs → 404 via
   notFound(); renders mock data until API_MODE=live flips the data source. */
export default async function ComponentDetailPage({ params }: ComponentDetailProps) {
  const { slug } = await params
  const item = await loadComponent(slug)
  if (!item) notFound()

  return (
    <section className="flex flex-col gap-6">
      <nav className="text-sm text-muted-foreground">
        <Link
          href="/components"
          className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Back to catalog
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">/{item.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.category === 'animation' ? 'brand' : 'neutral'}>
            {item.category}
          </Badge>
          {item.isPublished ? <Badge variant="success">published</Badge> : null}
          <span className="font-mono text-xs text-muted-foreground">v{item.latestVersion}</span>
        </div>
      </header>

      {item.category === 'animation' ? <PreviewPanel componentName={item.name} /> : null}

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
