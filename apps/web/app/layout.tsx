import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

/* Server Component by default — the root layout NEVER becomes a client
   component; client islands opt in per leaf component (`'use client'`). */

/* Inter is the Figma typeface; the `vietnamese` subset covers UI copy. The
   variable feeds --font-sans in globals.css. */
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'component-marketplace',
  description:
    'Marketplace for reusable UI components & animations, built by developers for developers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen" data-smoke="web">
        {children}
      </body>
    </html>
  )
}
