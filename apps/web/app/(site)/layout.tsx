import { SiteShell } from '@/components/layout/site-shell'

/* (site) route group — every page that sits inside the NavBar + Footer
   shell. The auth screens live in the sibling (auth) group, which fills the
   viewport on its own (Figma 154:6049 / 154:5838 have no NavBar). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
