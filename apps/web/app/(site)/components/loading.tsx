import { CatalogListSkeleton } from '@/components/catalog/catalog-skeleton'

/* Shown at once when the catalog list is requested, while the server renders it. */
export default function CatalogListLoading() {
  return <CatalogListSkeleton />
}
