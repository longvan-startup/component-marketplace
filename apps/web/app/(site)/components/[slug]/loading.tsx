import { ComponentDetailSkeleton } from '@/components/catalog/catalog-skeleton'

/* Shown at once when a component detail page is requested, while the server renders it. */
export default function ComponentDetailLoading() {
  return <ComponentDetailSkeleton />
}
