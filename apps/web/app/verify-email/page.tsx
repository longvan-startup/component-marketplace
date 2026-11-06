import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthStatusBanner } from '@/components/auth/auth-status-banner'
import { ResendVerificationForm } from '@/components/auth/resend-verification-form'
import { Card } from '@/components/ui/card'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Xác minh email',
}

interface VerifyEmailPageProps {
  searchParams: Promise<{ error?: string | string[] }>
}

/**
 * Verify-email — Server Component. Better Auth's `GET /api/auth/verify-email`
 * callback does the verification itself and redirects here (apps/api/AUTH.md)
 * — this page never calls an API to "verify" anything, it only reads what
 * arrived in its own query string.
 *
 * `?error=...` present → the link was invalid/expired/for an unknown user.
 * No `error` → either just-verified successfully, or a direct visit with no
 * token yet — Better Auth's own success redirect carries no marker of its
 * own (see AUTH.md), so both cases render the same calm "you're set, or
 * request a new link" message; there is no safe way to tell them apart from
 * query params alone, and guessing wrongly would be worse than not guessing.
 */
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams
  const hasError = params.error !== undefined
  const apiMode = resolveApiMode()

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Xác minh email</h1>
      </header>
      <Card className="flex flex-col gap-4 p-6">
        {hasError ? (
          <AuthStatusBanner variant="error">
            Link đã hết hạn hoặc không hợp lệ — yêu cầu link mới bên dưới.
          </AuthStatusBanner>
        ) : (
          <AuthStatusBanner variant="info">
            Nếu bạn vừa bấm link xác minh, tài khoản đã được xác minh — có thể đăng nhập ngay. Chưa
            nhận được link? Nhập email bên dưới để gửi lại.
          </AuthStatusBanner>
        )}
        <ResendVerificationForm apiMode={apiMode} />
      </Card>
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Về trang chủ
      </Link>
    </section>
  )
}
