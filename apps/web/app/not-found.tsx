import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Không tìm thấy trang',
}

/* Shown for any unknown URL, and by notFound() on the detail page. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Không tìm thấy trang</h1>
      <p className="text-base leading-6 text-muted-foreground">
        Trang bạn tìm không tồn tại hoặc đã được chuyển đi. Bạn có thể quay về trang chủ hoặc xem
        danh sách component.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses({ size: 'lg' })}>
          Về trang chủ
        </Link>
        <Link href="/components" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          Xem component
        </Link>
      </div>
    </main>
  )
}
