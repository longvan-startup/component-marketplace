/**
 * AuthShell — the split layout shared by Đăng nhập (Figma 154:6049) and
 * Đăng ký (154:5838): a 560px form panel on the left, the dark showcase on
 * the right. Server Component; the forms passed as children are the client
 * islands. Below `lg` the showcase is dropped and the panel fills the width
 * (Figma has no mobile frame for these screens).
 */
import type { ReactNode } from 'react'
import { Logo } from '../layout/logo'
import { AuthShowcase } from './auth-showcase'

export function AuthShell({
  title,
  subtitle,
  showcaseTitle,
  showcaseSubtitle,
  children,
}: {
  title: string
  subtitle: string
  showcaseTitle: string
  showcaseSubtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-card text-foreground lg:grid-cols-[560px_minmax(0,1fr)]">
      <main className="mx-auto flex w-full max-w-[560px] flex-col justify-center gap-5 px-6 py-12 sm:px-[72px]">
        <Logo className="w-fit" />
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        </header>
        {children}
      </main>
      <AuthShowcase title={showcaseTitle} subtitle={showcaseSubtitle} />
    </div>
  )
}
