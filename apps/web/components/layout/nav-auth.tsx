'use client'

/**
 * NavAuth — the session-aware right end of the desktop NavBar. Reads the
 * Better Auth session once on mount (the cookie is HTTP-only, so only the
 * API can tell us who is signed in) and swaps the Đăng nhập / Đăng ký links
 * for the user's name + Đăng xuất. Signed-out is the render before the
 * session resolves, so there is no layout jump for anonymous visitors.
 */
import type { AuthUser } from '@marketplace/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type ApiMode, getAuthSource } from '../../features/auth/auth-source'
import { Button, buttonClasses } from '../ui/button'
import { NAV_ACTIONS } from './nav-items'

export function NavAuth({ apiMode }: { apiMode: ApiMode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    getAuthSource(apiMode)
      .getSession()
      .then((session) => {
        if (active) setUser(session?.user ?? null)
      })
      .catch(() => {
        // Unreachable API or bad payload: stay on the signed-out links.
      })
    return () => {
      active = false
    }
  }, [apiMode])

  async function signOut() {
    try {
      await getAuthSource(apiMode).signOut()
    } finally {
      setUser(null)
      router.refresh()
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-40 truncate text-sm font-medium text-foreground">
          {user.name || user.email}
        </span>
        <Button variant="ghost" size="sm" onClick={signOut}>
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
