/**
 * Site shell — NavBar + Footer around every page. Server Component on
 * purpose: no state, no browser APIs (the mobile menu is its own island).
 */
import type { ReactNode } from 'react'
import { Footer } from './footer'
import { NavBar } from './nav-bar'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  )
}
