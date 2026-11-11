import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { Card } from '@/components/ui/card'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
}

/* Forgot-password — Server Component shell around the client form island.
   `API_MODE` is a server-only env var (not inlined into the client bundle),
   so it's resolved here and passed down as a prop — see auth-source.ts. */
export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Quên mật khẩu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
        </p>
      </header>
      <Card className="p-6">
        <ForgotPasswordForm apiMode={resolveApiMode()} />
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
