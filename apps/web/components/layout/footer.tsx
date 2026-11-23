/**
 * Footer — Figma `Footer` (134:3645, master 10:67). Built from components:
 * FooterBrand (logo, blurb, social row, newsletter), FooterColumn (heading plus
 * links), FooterDotField (the "Dot Mountain" band) and FooterLegal (copyright
 * and legal links). Links to routes not built yet use the same NavLink look
 * with the default cursor, so they never look like dead anchors. The newsletter
 * form is shown but does not save anything until its backend exists, and the
 * mail icon has no address yet.
 */
import { IconSocialGitHub, IconSocialMail } from '../ui/icons'
import { NAV_LINK_BASE, NavLink } from '../ui/nav-link'
import { FooterDotField } from './footer-dot-field'
import { BRAND_NAME, Logo } from './logo'
import { NAV_LINKS } from './nav-items'
import { NewsletterForm } from './newsletter-form'

const REPO_URL = 'https://github.com/longvan-startup/component-marketplace'

const COLUMNS = [
  { title: 'Sản phẩm', items: ['Danh mục', 'Gói thành viên', 'Cộng đồng'] },
  { title: 'Công ty', items: ['Điều khoản', 'Bảo mật', 'Liên hệ'] },
  { title: 'Tài nguyên', items: ['Hướng dẫn', 'Câu hỏi thường gặp', 'Blog'] },
] as const

const LEGAL_LINKS = ['Bảo mật', 'Điều khoản', 'Giấy phép'] as const

/* Planned items share the NavLink base so their hover matches live links. */
const PLANNED_CLASS = `${NAV_LINK_BASE} cursor-default text-[13px]`

function SocialRow() {
  return (
    <div className="-ml-2 flex items-center gap-2 text-muted-foreground">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        className="inline-flex cursor-default rounded-badge p-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconSocialGitHub />
      </a>
      <span className="inline-flex cursor-default p-2 transition-colors hover:text-primary">
        <IconSocialMail />
      </span>
    </div>
  )
}

function FooterBrand() {
  return (
    <div className="flex w-full max-w-[400px] shrink-0 flex-col items-start gap-3">
      <Logo className="text-[15px] font-bold" />
      <p className="text-[13px] text-muted-foreground">
        Khám phá các component UI trong thư viện cho dự án của bạn.
      </p>
      <SocialRow />
      <p className="text-xs font-medium text-muted-foreground">Nhận component mới hàng tuần</p>
      <NewsletterForm />
    </div>
  )
}

function FooterColumn({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <nav aria-label={title} className="flex flex-col items-start gap-4">
      <p className="px-0.5 text-[13px] font-semibold text-foreground">{title}</p>
      {items.map((label) => {
        const live = NAV_LINKS.find((link) => link.label === label)
        return live ? (
          <NavLink key={label} href={live.href} className="cursor-default text-[13px]">
            {label}
          </NavLink>
        ) : (
          <span key={label} className={PLANNED_CLASS}>
            {label}
          </span>
        )
      })}
    </nav>
  )
}

function FooterLegal() {
  return (
    <div className="flex flex-col gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8 xl:px-[120px]">
      <p>© 2026 {BRAND_NAME}</p>
      <div className="flex flex-wrap gap-6">
        {LEGAL_LINKS.map((label) => (
          <span key={label} className="cursor-default transition-colors hover:text-primary">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="overflow-x-clip bg-card">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mx-4 h-px bg-border md:mx-8 xl:mx-[120px]" />

        <div className="flex flex-col gap-10 px-4 pb-8 pt-14 md:flex-row md:gap-20 md:px-8 xl:px-[120px]">
          <FooterBrand />
          <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <FooterColumn key={column.title} title={column.title} items={column.items} />
            ))}
          </div>
        </div>

        <div className="relative left-1/2 w-screen -translate-x-1/2">
          <FooterDotField src="/footer/9aa6b.svg" />
        </div>

        <FooterLegal />
      </div>
    </footer>
  )
}
