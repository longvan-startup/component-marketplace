import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthHeading } from '@/components/auth/auth-shell'
import { SignUpForm } from '@/components/auth/forms/sign-up-form'
import { SocialButtons } from '@/components/auth/forms/social-buttons'
import { loadSocialProviders, resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Đăng ký',
}

/* Đăng ký — Figma 154:5838. Same shell as /login, three-field form. */
export default async function RegisterPage() {
  const apiMode = resolveApiMode()
  const providers = await loadSocialProviders(apiMode)
  return (
    <>
      <AuthHeading
        title="Tạo tài khoản miễn phí"
        subtitle="Khám phá và tải hàng trăm component UI, miễn phí."
      />
      <SignUpForm apiMode={apiMode} />
      <SocialButtons providers={providers} />
      <p className="text-center text-[13px] text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  )
}
