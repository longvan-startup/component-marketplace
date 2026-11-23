import { LoadingStatus, Skeleton } from '@/components/ui/skeleton'

/* Shown inside the auth panel while a sign-in or sign-up page streams. The logo and
   the showcase are already on screen (they live in the layout), so this only
   stands in for the heading, the social buttons and the form fields. */
export default function AuthLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <LoadingStatus label="Đang tải…" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  )
}
