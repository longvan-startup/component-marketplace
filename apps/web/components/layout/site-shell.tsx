/**
 * Site shell — NavBar + Footer around every page. Server Component on
 * purpose: no state, no browser APIs (the mobile menu is its own island).
 */
import type { ReactNode } from 'react'
import { resolveApiMode } from '../../features/auth/auth-source'
import { Footer } from './footer'
import { NavBar } from './nav-bar'
import { NavSessionFeedback, NavSessionProvider } from './nav-session'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <NavSessionProvider apiMode={resolveApiMode()}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <NavBar />
        <NavSessionFeedback />
        {/* min-h: the viewport minus the navbar (72px), so a short page still
            pushes the footer below the first screen; it shows after scrolling. */}
        <main className="mx-auto min-h-[calc(100svh-4.5rem)] w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <Footer />
      </div>
    </NavSessionProvider>
  )
}
