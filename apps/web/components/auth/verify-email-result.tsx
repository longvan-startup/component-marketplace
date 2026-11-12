'use client'

/**
 * Kết quả xác minh email. Thành công: cookie phiên đã được API đặt khi bấm
 * link, nên NavBar trên trang chủ sẽ hiện người dùng đã đăng nhập. Đếm ngược
 * rồi tự chuyển về trang chủ; có nút để chuyển ngay.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { AuthStatusBanner } from './auth-status-banner'

const REDIRECT_SECONDS = 5

export function VerifyEmailResult({ failed }: { failed: boolean }) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    if (failed) return
    if (seconds === 0) {
      router.replace('/')
      router.refresh()
      return
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [failed, seconds, router])

  function goHome() {
    router.replace('/')
    router.refresh()
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Xác minh email</h1>
      </header>
      <Card className="flex flex-col gap-4 p-6">
        {failed ? (
          <>
            <AuthStatusBanner variant="error">
              Link đã hết hạn hoặc không hợp lệ. Hãy đăng nhập để nhận link xác minh mới.
            </AuthStatusBanner>
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-badge bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Đến trang đăng nhập
            </Link>
          </>
        ) : (
          <>
            <AuthStatusBanner variant="success">
              Tài khoản đã được xác minh. Bạn đã đăng nhập.
            </AuthStatusBanner>
            <p className="text-center text-sm text-muted-foreground">
              Chuyển về trang chủ sau {seconds} giây.
            </p>
            <Button onClick={goHome}>Về trang chủ ngay</Button>
          </>
        )}
      </Card>
    </section>
  )
}
