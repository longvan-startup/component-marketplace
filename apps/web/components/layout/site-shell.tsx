/**
 * Site shell — header + footer around every page. Server Component on
 * purpose: no state, no browser APIs. APP_NAME comes from @marketplace/shared
 * (the only internal dependency the web app is allowed to have).
 */

import { APP_NAME, APP_VERSION } from '@marketplace/shared'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/components"
              className="rounded-badge px-2 py-1.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Components
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
          <span>
            {APP_NAME} <code>v{APP_VERSION}</code> — marketplace for UI components & animations
          </span>
          <span>@NguyenTuMinhLong · @DaoDungVan</span>
        </div>
      </footer>
    </div>
  )
}
