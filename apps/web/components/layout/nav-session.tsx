'use client'

import type { AuthUser } from '@marketplace/shared'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type ApiMode, getAuthSource } from '../../features/auth/auth-source'

type NavSessionValue = {
  user: AuthUser | null
  signOut: () => Promise<void>
}

const NavSessionContext = createContext<NavSessionValue | null>(null)

/** Shares one auth session and logout action between desktop and mobile navigation.
 * @param apiMode Selects the live or mock auth source.
 * @param children Navigation controls that consume the session.
 */
export function NavSessionProvider({
  apiMode,
  children,
}: {
  apiMode: ApiMode
  children: React.ReactNode
}) {
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
        // An unreachable auth API keeps the same guest fallback as the desktop nav.
      })
    return () => {
      active = false
    }
  }, [apiMode])

  const signOut = useCallback(async () => {
    try {
      await getAuthSource(apiMode).signOut()
    } finally {
      setUser(null)
      router.refresh()
    }
  }, [apiMode, router])

  const value = useMemo(() => ({ user, signOut }), [user, signOut])
  return <NavSessionContext.Provider value={value}>{children}</NavSessionContext.Provider>
}

/** Reads the session state owned by the nearest navigation provider.
 * @returns The current user and shared logout action.
 * @throws If rendered outside `NavSessionProvider`.
 */
export function useNavSession(): NavSessionValue {
  const value = useContext(NavSessionContext)
  if (!value) throw new Error('Nav session components must be inside NavSessionProvider')
  return value
}
