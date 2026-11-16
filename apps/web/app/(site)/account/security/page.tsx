import type { Metadata } from 'next'
import { SecuritySettings } from '@/components/auth/security-settings'
import { resolveApiMode } from '@/features/auth/auth-source'

export const metadata: Metadata = {
  title: 'Bảo mật tài khoản',
}

export default function AccountSecurityPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-primary">Tài khoản</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Bảo mật</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quản lý mật khẩu và các phiên đăng nhập của bạn.
        </p>
      </header>
      <SecuritySettings apiMode={resolveApiMode()} />
    </section>
  )
}
