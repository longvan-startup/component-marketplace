'use client'

/**
 * Mobile menu — client island (open/close state). Figma has no mobile frame,
 * so this is derived from the desktop NavBar: same links and actions, stacked
 * in a panel under the header. Closes on route change and on Escape.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { buttonClasses } from '../ui/button'
import { IconClose, IconMenu } from '../ui/icons'
import { NAV_ACTIONS, NAV_LINKS } from './nav-items'
import { SearchForm } from './search-form'

export function MobileMenu() {
  const panelId = useId()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger — navigating closes the panel.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-badge text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-card px-4 pb-4 pt-3"
      >
        <SearchForm />
        <nav aria-label="Điều hướng chính" className="mt-3 flex flex-col">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href={NAV_ACTIONS.login.href} className={buttonClasses({ variant: 'secondary' })}>
            {NAV_ACTIONS.login.label}
          </Link>
          <Link href={NAV_ACTIONS.register.href} className={buttonClasses()}>
            {NAV_ACTIONS.register.label}
          </Link>
        </div>
      </div>
    </div>
  )
}
