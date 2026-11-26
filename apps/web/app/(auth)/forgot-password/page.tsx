import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthHeading } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/forms/forgot-password-form'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
}

/* Forgot-password — Server Component shell around the client form island, inside
   the same split layout as /login and /register. `API_MODE` is a server-only env
   var (not inlined into the client bundle), so it's resolved here and passed down
   as a prop — see auth-source.ts. */
export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Quên mật khẩu"
        subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu."
      />
      <ForgotPasswordForm apiMode={resolveApiMode()} />
      <p className="text-center text-[13px] text-muted-foreground">
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </>
  )
}
