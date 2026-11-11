/**
 * NavBar — Figma `NavBar` (10:51): sticky site header, 32px side gutter at
 * 1440. Server Component; the only client part is the mobile menu island.
 * Below `md` the links, search and actions collapse into that menu.
 */
import { resolveApiMode } from '../../features/auth/auth-source'
import { NavLink } from '../ui/nav-link'
import { Logo } from './logo'
import { MobileMenu } from './mobile-menu'
import { NavAuth } from './nav-auth'
import { NAV_LINKS } from './nav-items'
import { SearchForm } from './search-form'

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="relative mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <SearchForm className="hidden w-80 lg:flex" />
          <NavAuth apiMode={resolveApiMode()} />
        </div>

        <MobileMenu />
      </div>
    </header>
  )
}
