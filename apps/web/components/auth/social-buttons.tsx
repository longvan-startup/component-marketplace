'use client'

/**
 * Social sign-in row — Figma `Button/Social` (154:5832) ×2 + `Divider/Or`
 * (154:5837). Live mode starts Google or GitHub OAuth. Mock mode stays
 * disabled because there is no provider to redirect to. A successful new
 * account is a Free user (`role: user`); OAuth does not grant Pro.
 */
import Image from 'next/image'
import { useState } from 'react'
import { type ApiMode, AuthRequestError, getAuthSource } from '@/features/auth/auth-source'
import { socialCallbackUrl, socialErrorCallbackUrl } from '@/features/auth/safe-callback-url'
import { IconSocialGitHub } from '../ui/icons'
import { AuthStatusBanner } from './auth-status-banner'

const BUTTON_CLASSES =
  'flex h-[34px] w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'

type Provider = 'google' | 'github'

function socialErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError && error.code === 'PROVIDER_NOT_FOUND') {
    return 'Đăng nhập này chưa được cấu hình trên máy chủ.'
  }
  return 'Không mở được đăng nhập. Thử lại sau.'
}

export function SocialButtons({ apiMode, failed = false }: { apiMode: ApiMode; failed?: boolean }) {
  const live = apiMode === 'live'
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(
    failed ? 'Đăng nhập Google hoặc GitHub không thành công. Thử lại.' : null,
  )

  async function start(provider: Provider) {
    setPending(provider)
    setError(null)
    try {
      const { url } = await getAuthSource(apiMode).signInSocial(
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

  return (
    <>
      {error && <AuthStatusBanner variant="error">{error}</AuthStatusBanner>}
      <button
        type="button"
        className={BUTTON_CLASSES}
        disabled={!live || pending !== null}
        title={live ? undefined : 'Cần kết nối API thật'}
        onClick={() => start('google')}
      >
        <Image src="/auth/google.svg" alt="" width={18} height={18} className="size-[18px]" />
        {pending === 'google' ? 'Đang chuyển tới Google…' : 'Tiếp tục với Google'}
      </button>
      <button
        type="button"
        className={BUTTON_CLASSES}
        disabled={!live || pending !== null}
        title={live ? undefined : 'Cần kết nối API thật'}
        onClick={() => start('github')}
      >
        <IconSocialGitHub className="size-4" />
        {pending === 'github' ? 'Đang chuyển tới GitHub…' : 'Tiếp tục với GitHub'}
      </button>
      <div className="flex h-2.5 items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  )
}
