import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { SocialButtons } from '@/components/auth/social-buttons'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Đăng ký',
}

/* Đăng ký — Figma 154:5838. Same shell as /login, three-field form. */
export default function RegisterPage() {
  return (
    <AuthShell
      title="Tạo tài khoản miễn phí"
      subtitle="Khám phá và tải hàng trăm component UI, miễn phí."
      showcaseTitle="Component UI chất lượng, sẵn dùng ngay"
      showcaseSubtitle="Xem trước animation trước khi tải — không cần viết lại từ đầu."
    >
      <SocialButtons />
      <SignUpForm apiMode={resolveApiMode()} />
      <p className="text-center text-[13px] text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  )
}
