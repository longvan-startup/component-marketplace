'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button, buttonClasses } from '@/components/ui/button'

/* Shown when a page under the root layout throws while rendering. The error
   detail goes to the console for developers, never to the page. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Có lỗi xảy ra</h1>
      <p className="text-base leading-6 text-muted-foreground">
        Trang chưa tải được. Bạn thử lại sau ít phút, hoặc quay về trang chủ.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Thử lại
        </Button>
        <Link href="/" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
