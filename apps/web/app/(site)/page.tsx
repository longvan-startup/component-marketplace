import type { CatalogCategory } from '@marketplace/shared'
import Link from 'next/link'
import { ComponentCard } from '@/components/catalog/component-card'
import { FeaturedCarousel } from '@/components/home/featured-carousel'
import { HeroBackdrop } from '@/components/home/hero-backdrop'
import { HeroText } from '@/components/home/hero-text'
import { Words } from '@/components/home/hero-words'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CATEGORY_OPTIONS } from '@/features/catalog/catalog-labels'
import { getCatalogSource } from '@/features/catalog/catalog-source'
import { getDemoManifest } from '@/features/demo/demo-source'

/* Home — Server Component. Layout follows the Figma Home frame (13:18): hero,
   featured components, category links and "Why Luva UI". Every list reads the
   catalog data layer; the copy about categories and featured items only claims
   what the catalog really does. */
/* Static page regenerated in the background every 60 seconds, so visits are
   served from the CDN. A catalog outage is cached only until the next
   regeneration after the API recovers (at most about a minute). */
export const revalidate = 60

const CATEGORIES = CATEGORY_OPTIONS

/* The featured row slides, so it carries more than the four a grid would fit. */
const FEATURED_COUNT = 8

const WHY_ITEMS = [
  {
    title: 'Khám phá component',
    body: 'Xem mô tả và thông tin phiên bản của từng component trong thư viện.',
  },
  {
    title: 'Lọc và tìm nhanh',
    body: 'Lọc theo danh mục, tìm theo từ khóa, có ngay component phù hợp.',
  },
  {
    title: 'Cộng đồng hỗ trợ',
    body: 'Tham gia forum, đặt câu hỏi, nhận phản hồi trực tiếp từ cộng đồng dev.',
  },
] as const

export default async function HomePage() {
  const source = getCatalogSource()
  /* Any failure (not just 503 or a network error) becomes an unavailable
     result, so a bad API response never fails the build or the render. */
  const list = (query: { category?: CatalogCategory; pageSize: number }) =>
    source.list(query).catch(() => ({
      items: [],
      page: 1,
      pageSize: query.pageSize,
      total: 0,
      unavailable: true,
    }))
  const [featured, ...counts] = await Promise.all([
    list({ pageSize: FEATURED_COUNT }),
    ...CATEGORIES.map((category) => list({ category: category.value, pageSize: 1 })),
  ])
  const highlights = featured.items.slice(0, FEATURED_COUNT)
  const featuredHeading = (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Component nổi bật</h2>
      <p className="text-sm text-muted-foreground">Một số component đã publish trên thư viện.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-24 pb-8">
      {/* The hero reaches up under the transparent navbar, so the bubbles are not
          cut by a hard edge below it: -mt-26 is the navbar (72px) plus the main
          padding (32px), and pt-50 gives that height back to the content. */}
      <section className="relative left-1/2 isolate -mt-26 flex w-screen -translate-x-1/2 flex-col items-center gap-6 overflow-hidden pb-24 pt-50 text-center">
        <HeroBackdrop />
        <HeroText>
          <h1 className="max-w-[800px] text-4xl font-bold leading-[1.125] md:text-[64px] md:leading-[72px]">
            <Words>Thư viện</Words>{' '}
            <span className="text-primary">
              <Words>component</Words>
            </span>{' '}
            <Words>sẵn dùng cho dự án của bạn</Words>
          </h1>
          <p className="max-w-[640px] text-base leading-6 text-muted-foreground">
            <Words>
              Khám phá các component UI đã publish và tìm thông tin phù hợp cho dự án của bạn.
            </Words>
          </p>
        </HeroText>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/components"
            className={buttonClasses({ size: 'lg', className: 'h-12 px-6 text-base' })}
          >
            Khám phá component
          </Link>
          <span
            aria-disabled="true"
            className={buttonClasses({
              variant: 'secondary',
              size: 'lg',
              className: 'h-12 cursor-default px-6 text-base',
            })}
          >
            Tham gia cộng đồng
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        {featured.unavailable ? (
          <>
            {featuredHeading}
            <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Catalog tạm thời chưa tải được. Vui lòng thử lại sau.
            </p>
          </>
        ) : (
          <FeaturedCarousel heading={featuredHeading}>
            {highlights.map((item) => (
              <ComponentCard key={item.id} item={item} demo={getDemoManifest(item.slug)} />
            ))}
          </FeaturedCarousel>
        )}
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold tracking-tight">Duyệt theo danh mục</h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CATEGORIES.map((category, index) => (
            <li key={category.value} className="min-w-0">
              <Link
                href={`/components?category=${category.value}`}
                className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="flex flex-col gap-2 p-6 transition-colors hover:border-primary/40 hover:bg-muted">
                  <span className="font-semibold tracking-tight">{category.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {counts[index]?.unavailable
                      ? 'Đang cập nhật'
                      : `${counts[index]?.total ?? 0} component`}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Vì sao chọn Luva UI</h2>
          <p className="text-sm text-muted-foreground">
            Mọi thứ bạn cần để tìm và dùng component nhanh hơn.
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {WHY_ITEMS.map((item, index) => (
            <li key={item.title} className="flex flex-col gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
