import type { Metadata } from 'next'
import { SiteShell } from '@/components/layout/site-shell'
import './globals.css'

/* Server Component by default — the root layout NEVER becomes a client
   component; client islands opt in per leaf component (`'use client'`). */

export const metadata: Metadata = {
  title: 'component-marketplace',
  description:
    'Marketplace for reusable UI components & animations, built by developers for developers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen" data-smoke="web">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
