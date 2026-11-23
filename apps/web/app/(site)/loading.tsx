import { LoadingStatus, Skeleton } from '@/components/ui/skeleton'

/* Shown while any page under (site) streams. Generic on purpose: a page that
   needs its own shape adds a loading.tsx next to it. */
export default function SiteLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-8">
      <LoadingStatus label="Đang tải trang…" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-card border border-border bg-card p-5"
          >
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  )
}
