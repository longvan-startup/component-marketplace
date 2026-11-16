'use client'

/**
 * NavAuth — the session-aware right end of the desktop NavBar. Reads the
 * Better Auth session once on mount (the cookie is HTTP-only, so only the
 * API can tell us who is signed in) and swaps the Đăng nhập / Đăng ký links
 * for the user's name + Đăng xuất. Signed-out is the render before the
 * session resolves, so there is no layout jump for anonymous visitors.
 */
import Link from 'next/link'
import { Button, buttonClasses } from '../ui/button'
import { NAV_ACTIONS } from './nav-items'
import { useNavSession } from './nav-session'

export function NavAuth() {
  const { user, signOut, pendingAction } = useNavSession()

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-40 truncate text-sm font-medium text-foreground">
          {user.name || user.email}
        </span>
        <Link
          href="/account/security"
          className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'min-h-11' })}
        >
          Bảo mật
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          loading={pendingAction !== null}
          onClick={() => void signOut()}
        >
          Đăng xuất
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={NAV_ACTIONS.login.href}
        className={buttonClasses({ variant: 'ghost', size: 'sm' })}
      >
        {NAV_ACTIONS.login.label}
      </Link>
      <Link href={NAV_ACTIONS.register.href} className={buttonClasses({ size: 'sm' })}>
        {NAV_ACTIONS.register.label}
      </Link>
    </div>
  )
}
