import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthHeading } from '@/components/auth/auth-shell'
import { AuthStatusBanner } from '@/components/auth/auth-status-banner'
import { ResetPasswordForm } from '@/components/auth/forms/reset-password-form'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu',
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>
}

/**
 * Reset-password — Server Component reading `token`/`error` straight from
 * its own query string. Better Auth's GET `/reset-password/:token` callback
 * redirects here with one or the other (apps/api/AUTH.md) — this page never
 * calls an API to "start" anything, it just branches on what arrived.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : undefined
  const hasError = params.error !== undefined

  return (
    <>
      <AuthHeading title="Đặt lại mật khẩu" subtitle="Chọn mật khẩu mới cho tài khoản của bạn." />
      {token && !hasError ? (
        <ResetPasswordForm token={token} apiMode={resolveApiMode()} />
      ) : (
        <div className="flex flex-col gap-4">
          <AuthStatusBanner variant="error">
            Link đã hết hạn hoặc không hợp lệ — yêu cầu link mới.
          </AuthStatusBanner>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Yêu cầu link mới →
          </Link>
        </div>
      )}
    </>
  )
}
