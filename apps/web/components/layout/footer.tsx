/**
 * Footer — Figma `Footer` (134:3645, master 10:67): brand block with social
 * icons and the newsletter field, three link columns, the "Dot Mountain" band
 * and the legal row. Links to routes not built yet render as plain text with
 * the same hover colour, never as dead anchors. The newsletter form is shown but
 * disabled until its backend exists, and the mail icon has no address yet.
 */
import Link from 'next/link'
import { IconSearch, IconSocialGitHub, IconSocialMail } from '../ui/icons'
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

/* No horizontal padding, so every item lines up with its column heading. */
const LINK_CLASS =
  'block rounded-sm text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const PLANNED_CLASS =
  'block text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary'

export function Footer() {
  return (
    <footer className="overflow-x-clip bg-card">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mx-4 h-px bg-border md:mx-8 xl:mx-[120px]" />

        <div className="flex flex-col gap-10 px-4 pb-8 pt-14 md:flex-row md:gap-20 md:px-8 xl:px-[120px]">
          <div className="flex w-full max-w-[280px] shrink-0 flex-col items-start gap-3">
            <Logo className="text-[15px] font-bold" />
            <p className="text-[13px] text-muted-foreground">
              Thư viện UI component sẵn dùng, xem trước animation trước khi tải — cho mọi dự án của
              bạn.
            </p>
            <div className="-ml-2 flex items-center gap-2 text-muted-foreground">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="inline-flex rounded-badge p-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <IconSocialGitHub />
              </a>
              <span className="inline-flex p-2 transition-colors hover:text-primary">
                <IconSocialMail />
              </span>
            </div>

            <p className="text-xs font-medium text-muted-foreground">
              Nhận component mới hàng tuần
            </p>
            <form className="flex w-full max-w-[340px] items-center gap-2">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring">
                <IconSearch className="shrink-0 text-muted-foreground" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  disabled
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </label>
              <button
                type="submit"
                disabled
                className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Đăng ký
              </button>
            </form>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav
                key={column.title}
                aria-label={column.title}
                className="flex flex-col items-start gap-4"
              >
                <p className="text-[13px] font-semibold text-foreground">{column.title}</p>
                {column.items.map((label) => {
                  const live = NAV_LINKS.find((link) => link.label === label)
                  return live ? (
                    <Link key={label} href={live.href} className={LINK_CLASS}>
                      {label}
                    </Link>
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

        <div className="relative left-1/2 w-screen -translate-x-1/2">
          <FooterDotField src="/footer/9aa6b.svg" />
        </div>

        <div className="flex flex-col gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8 xl:px-[120px]">
          <p>© 2026 {BRAND_NAME}</p>
          <div className="flex flex-wrap gap-6">
            {LEGAL_LINKS.map((label) => (
              <span key={label} className="transition-colors hover:text-primary">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
