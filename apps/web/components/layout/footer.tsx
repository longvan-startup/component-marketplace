/**
 * Footer — Figma `Footer` (10:67). Only links to routes that exist are
 * rendered (issue #135): the "Công ty"/"Tài nguyên" columns, the legal row
 * and the newsletter form from Figma wait for their pages/backend.
 */
import { IconSocialGitHub } from '../ui/icons'
import { NavLink } from '../ui/nav-link'
import { BRAND_NAME, Logo } from './logo'
import { NAV_LINKS } from './nav-items'

const REPO_URL = 'https://github.com/longvan-startup/component-marketplace'

export function Footer() {
  return (
    <footer className="bg-card">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8">
        <div className="h-px w-full bg-border" />

        <div className="flex flex-col gap-10 pb-8 pt-14 md:flex-row md:gap-20 xl:px-[120px]">
          <div className="flex max-w-[280px] flex-col items-start gap-3">
            <Logo className="text-[15px] font-bold" />
            <p className="text-[13px] text-muted-foreground">
              Thư viện UI component sẵn dùng, xem trước animation trước khi tải — cho mọi dự án của
              bạn.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="inline-flex size-11 items-center justify-center rounded-badge text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -ml-3.5"
            >
              <IconSocialGitHub />
            </a>
          </div>

          <nav aria-label="Sản phẩm" className="flex flex-col items-start gap-3">
            <p className="text-[13px] font-semibold text-foreground">Sản phẩm</p>
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} className="text-[13px]">
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <p className="py-5 text-xs text-muted-foreground xl:px-[120px]">© 2026 {BRAND_NAME}</p>
      </div>
    </footer>
  )
}
