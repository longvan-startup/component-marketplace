/**
 * AuthShell — the split layout shared by Đăng nhập (Figma 154:6049) and
 * Đăng ký (154:5838): a 560px form panel on the left, the dark showcase on
 * the right. It lives in the (auth) route layout, so switching between the two
 * pages keeps the logo, the showcase and its moving bubbles in place and only
 * swaps the form (with a short fade). The form content is pinned to the top, so
 * the logo and the heading sit at the same spot on both pages. Server Component;
 * the forms passed as children are the client islands. Below `lg` the showcase is
 * dropped and the panel fills the width (Figma has no mobile frame for these
 * screens).
 */
import type { ReactNode } from 'react'
import { Logo } from '../layout/logo'
import { AuthShowcase } from './auth-showcase'
import { RouteFade } from './route-fade'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-card text-foreground lg:grid-cols-[560px_minmax(0,1fr)]">
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 pb-12 pt-16 sm:px-[72px] sm:pt-24">
        <Logo className="w-fit" />
        <RouteFade className="flex flex-col gap-5">{children}</RouteFade>
      </main>
      <AuthShowcase />
    </div>
  )
}

/* The title and the line under it, at the top of each auth page. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-[13px] text-muted-foreground">{subtitle}</p>
    </header>
  )
}
