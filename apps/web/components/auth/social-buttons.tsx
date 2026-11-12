/**
 * Social sign-in row — Figma `Button/Social` (154:5832) ×2 + `Divider/Or`
 * (154:5837). The API has no OAuth provider configured yet, so both buttons
 * render disabled instead of pretending to work; wire them up when the
 * backend adds `socialProviders`.
 */
import Image from 'next/image'
import { IconSocialGitHub } from '../ui/icons'

const BUTTON_CLASSES =
  'flex h-[34px] w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60'

export function SocialButtons() {
  return (
    <>
      <button type="button" disabled title="Sắp ra mắt" className={BUTTON_CLASSES}>
        <Image src="/auth/google.svg" alt="" width={18} height={18} className="size-[18px]" />
        Tiếp tục với Google
      </button>
      <button type="button" disabled title="Sắp ra mắt" className={BUTTON_CLASSES}>
        <IconSocialGitHub className="size-4" />
        Tiếp tục với GitHub
      </button>
      <div className="flex h-2.5 items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">hoặc</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  )
}
