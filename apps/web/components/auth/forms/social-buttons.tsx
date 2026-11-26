'use client'

import type { SocialProvider } from '@marketplace/shared'
/**
 * Social sign-in row — two icon-only buttons (GitHub first, then Google) and
 * `Divider/Or`. Live mode starts Google or GitHub OAuth. Mock mode stays
 * disabled because there is no provider to redirect to. A successful new
 * account is a Free user (`role: user`); OAuth does not grant Pro.
 */
import Image from 'next/image'
import { useState } from 'react'
import { AuthRequestError, getAuthSource } from '@/features/auth/auth-source'
import { socialCallbackUrl, socialErrorCallbackUrl } from '@/features/auth/safe-callback-url'
import { IconSocialGitHub } from '../../ui/icons'
import { AuthStatusBanner } from '../auth-status-banner'
import { SocialButton } from './social-button'

function socialErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError && error.code === 'PROVIDER_NOT_FOUND') {
    return 'Đăng nhập này chưa được cấu hình trên máy chủ.'
  }
  return 'Không mở được đăng nhập. Thử lại sau.'
}

export function SocialButtons({
  providers,
  failed = false,
}: {
  providers: SocialProvider[]
  failed?: boolean
}) {
  const enabled = new Set(providers)
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(
    failed ? 'Đăng nhập Google hoặc GitHub không thành công. Thử lại.' : null,
  )

  async function start(provider: SocialProvider) {
    setPending(provider)
    setError(null)
    try {
      const { url } = await getAuthSource('live').signInSocial(
        provider,
        socialCallbackUrl(),
        socialErrorCallbackUrl(),
      )
      window.location.assign(url)
    } catch (caught) {
      setPending(null)
      setError(socialErrorMessage(caught))
    }
  }

  const labelFor = (provider: SocialProvider, name: string) =>
    pending === provider ? `Đang chuyển tới ${name}…` : `Tiếp tục với ${name}`
  const titleFor = (provider: SocialProvider, name: string) =>
    enabled.has(provider) ? name : 'Chưa được cấu hình'

  return (
    <>
      {error && <AuthStatusBanner variant="error">{error}</AuthStatusBanner>}
      <div className="flex gap-3">
        <SocialButton
          disabled={!enabled.has('github') || pending !== null}
          label={labelFor('github', 'GitHub')}
          title={titleFor('github', 'GitHub')}
          onClick={() => start('github')}
          icon={<IconSocialGitHub className="size-5" />}
        />
        <SocialButton
          disabled={!enabled.has('google') || pending !== null}
          label={labelFor('google', 'Google')}
          title={titleFor('google', 'Google')}
          onClick={() => start('google')}
          icon={<Image src="/auth/google.svg" alt="" width={20} height={20} className="size-5" />}
        />
      </div>
      <div className="flex h-2.5 items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  )
}
