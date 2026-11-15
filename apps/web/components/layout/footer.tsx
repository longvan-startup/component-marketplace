/**
 * Footer — Figma `Footer` (64:134, master 10:67): brand block, three link
 * columns, decorative "Dot Mountain" band and the legal row. Links that go to
 * routes not built yet render as plain text, never as dead anchors. The
 * newsletter field and the X/mail icons wait for their backend and URLs.
 */
import { IconSocialGitHub } from '../ui/icons'
import { NavLink } from '../ui/nav-link'
import { FooterDotField } from './footer-dot-field'
import { BRAND_NAME, Logo } from './logo'
import { NAV_LINKS } from './nav-items'

const REPO_URL = 'https://github.com/longvan-startup/component-marketplace'

const COLUMNS = [
  { title: 'Sản phẩm', items: ['Danh mục', 'Cộng đồng'] },
  { title: 'Công ty', items: ['Điều khoản', 'Bảo mật', 'Liên hệ'] },
  { title: 'Tài nguyên', items: ['Hướng dẫn', 'Câu hỏi thường gặp', 'Blog'] },
] as const

const LEGAL_LINKS = ['Bảo mật', 'Điều khoản', 'Giấy phép'] as const

const PLANNED_CLASS =
  'inline-flex items-center px-0.5 py-1 text-[13px] font-medium text-muted-foreground'

export function Footer() {
  return (
    <footer className="bg-card">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mx-4 h-px bg-border md:mx-8 xl:mx-[120px]" />

        <div className="flex flex-col gap-10 px-4 pb-8 pt-14 md:flex-row md:gap-20 md:px-8 xl:px-[120px]">
          <div className="flex w-full max-w-[280px] shrink-0 flex-col items-start gap-3">
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
              className="-ml-3.5 inline-flex size-11 items-center justify-center rounded-badge text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconSocialGitHub />
            </a>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav
                key={column.title}
                aria-label={column.title}
                className="flex flex-col items-start gap-3"
              >
                <p className="text-[13px] font-semibold text-foreground">{column.title}</p>
                {column.items.map((label) => {
                  const live = NAV_LINKS.find((link) => link.label === label)
                  return live ? (
                    <NavLink key={label} href={live.href} className="text-[13px]">
                      {label}
                    </NavLink>
                  ) : (
                    <span key={label} className={PLANNED_CLASS}>
                      {label}
                    </span>
                  )
                })}
              </nav>
            ))}
          </div>
        </div>

        <FooterDotField src="/footer/9aa6b.svg" />

        <div className="flex flex-col gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8 xl:px-[120px]">
          <p>© 2026 {BRAND_NAME}</p>
          <div className="flex flex-wrap gap-6">
            {LEGAL_LINKS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
