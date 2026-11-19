import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { SocialButtons } from '@/components/auth/social-buttons'
import { loadSocialProviders, resolveApiMode } from '@/features/auth/auth-source'
import { isSocialSignInError } from '@/features/auth/safe-callback-url'

export const metadata: Metadata = {
  title: 'Đăng nhập',
}

interface LoginPageProps {
  searchParams: Promise<{ oauth?: string | string[] }>
}

/* Đăng nhập — Figma 154:6049. Server Component shell; `API_MODE` is
   resolved here and passed to the client form (see auth-source.ts). */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const apiMode = resolveApiMode()
  const providers = await loadSocialProviders(apiMode)
  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Chào mừng quay lại Luva UI."
      showcaseTitle="Chào mừng quay lại"
      showcaseSubtitle="Tiếp tục khám phá các component UI trong thư viện."
    >
      <SocialButtons providers={providers} failed={isSocialSignInError(params.oauth)} />
      <SignInForm apiMode={apiMode} />
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
