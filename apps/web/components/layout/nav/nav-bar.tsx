/**
 * NavBar — Figma `NavBar` (10:51): sticky site header, 32px side gutter at
 * 1440. Server Component; its client parts are the sticky header frame (hides on
 * scroll down) and the mobile menu island.
 * Below `md` the links, search and actions collapse into that menu.
 */
import { ComingSoonLink, NavLink } from '../../ui/nav-link'
import { Logo } from '../logo'
import { StickyHeader } from '../sticky-header'
import { MobileMenu } from './mobile-menu'
import { NavAuth } from './nav-auth'
import { NavBackdrop } from './nav-backdrop'
import { NAV_LINKS, NAV_SOON } from './nav-items'
import { NavSearch } from './nav-search'

export function NavBar() {
  return (
    <StickyHeader>
      <NavBackdrop />
      <div className="relative mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
            {NAV_SOON.map((item) => (
              <ComingSoonLink key={item.label}>{item.label}</ComingSoonLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <NavSearch className="hidden lg:flex" />
          <NavAuth />
        </div>
        <MobileMenu />
      </div>
    </StickyHeader>
  )
}
