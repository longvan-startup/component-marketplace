import { LoadingStatus, Skeleton } from '@/components/ui/skeleton'

/* Shown while a sign-in or sign-up page streams. Matches the centred form. */
export default function AuthLoading() {
  return (
    <section aria-busy="true" className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <LoadingStatus label="Đang tải…" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </section>
  )
}
