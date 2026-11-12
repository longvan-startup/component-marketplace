import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { SocialButtons } from '@/components/auth/social-buttons'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Đăng nhập',
}

/* Đăng nhập — Figma 154:6049. Server Component shell; `API_MODE` is
   resolved here and passed to the client form (see auth-source.ts). */
export default function LoginPage() {
  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Chào mừng quay lại Luva UI."
      showcaseTitle="Chào mừng quay lại"
      showcaseSubtitle="Tiếp tục khám phá và tải component UI mới nhất."
    >
      <SocialButtons />
      <SignInForm apiMode={resolveApiMode()} />
      <p className="text-center text-[13px] text-muted-foreground">
        Chưa có tài khoản?{' '}
        <Link
          href="/register"
          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Đăng ký
        </Link>
      </p>
    </AuthShell>
  )
}
