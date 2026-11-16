import Link from 'next/link'
import { HeroBackdrop } from '@/components/home/hero-backdrop'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { type CatalogItem, getCatalogSource } from '@/features/catalog/catalog-source'

/* Home — Server Component. Layout follows the Figma Home frame (13:18): hero,
   featured components, category links and "Why Luva UI". Every list reads the
   catalog data layer; the copy about categories and featured items only claims
   what the catalog really does. */
export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { value: 'animation', label: 'Animation' },
  { value: 'react-component', label: 'React component' },
  { value: 'tool', label: 'Công cụ' },
] as const

const WHY_ITEMS = [
  {
    title: 'Xem trước animation',
    body: 'Xem component chạy animation thật trước khi tải, không cần đoán mò.',
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

const CATEGORY_LABEL: Record<CatalogItem['category'], string> = {
  animation: 'Animation',
  'react-component': 'React component',
  tool: 'Công cụ',
}

const TIER_LABEL = { free: 'Free', pro: 'Pro' } as const

function FeaturedCard({ item }: { item: CatalogItem }) {
  return (
    <Card className="flex h-full w-full flex-col overflow-hidden rounded-[16px] bg-muted">
      <div className="flex h-40 items-center justify-center font-mono text-sm text-muted-foreground">
        {CATEGORY_LABEL[item.category]}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
        <Link
          href={`/components/${item.slug}`}
          className="truncate text-base font-semibold leading-[22px] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.name}
        </Link>
        <p className="truncate text-sm leading-5 text-muted-foreground">by {item.author}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 px-4 pb-4">
        <Badge variant="neutral">{CATEGORY_LABEL[item.category]}</Badge>
        {item.tags.includes('gsap') ? <Badge variant="neutral">GSAP</Badge> : null}
        {item.accessTier ? (
          <Badge variant={item.accessTier === 'pro' ? 'accent' : 'success'}>
            {TIER_LABEL[item.accessTier]}
          </Badge>
        ) : null}
      </div>
    </Card>
  )
}

export default async function HomePage() {
  const source = getCatalogSource()
  const [featured, demo, ...counts] = await Promise.all([
    source.list({ pageSize: 4 }),
    source.detail('seed-spring-cards'),
    ...CATEGORIES.map((category) => source.list({ category: category.value, pageSize: 1 })),
  ])
  const highlights = [
    ...(demo ? [demo] : []),
    ...featured.items.filter((item) => item.id !== demo?.id),
  ].slice(0, 4)

  return (
    <div className="flex flex-col gap-24 pb-8">
      <section className="relative left-1/2 isolate flex w-screen -translate-x-1/2 flex-col items-center gap-6 overflow-hidden py-24 text-center">
        <HeroBackdrop />
        <h1 className="max-w-[800px] text-4xl font-bold leading-[1.125] md:text-[64px] md:leading-[72px]">
          Thư viện <span className="text-primary">component</span> sẵn dùng cho dự án của bạn
        </h1>
        <p className="max-w-[640px] text-base leading-6 text-muted-foreground">
          Duyệt, xem trước animation và tải component UI đã publish — xây giao diện nhanh hơn, không
          phải viết lại từ đầu.
        </p>
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
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Component nổi bật</h2>
          <p className="text-sm text-muted-foreground">
            Một số component đã publish trên thư viện.
          </p>
        </div>
        {featured.unavailable ? (
          <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Catalog tạm thời chưa tải được. Vui lòng thử lại sau.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item) => (
              <li key={item.id} className="min-w-0">
                <FeaturedCard item={item} />
              </li>
            ))}
          </ul>
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
