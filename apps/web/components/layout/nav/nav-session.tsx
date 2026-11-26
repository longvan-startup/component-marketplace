'use client'

import type { AuthUser } from '@marketplace/shared'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { type ApiMode, getAuthSource } from '../../../features/auth/auth-source'
import { AuthStatusBanner } from '../../auth/auth-status-banner'
import {
  finishLogoutAction,
  initialNavSessionState,
  type NavSessionAction,
  type NavSessionStatus,
  navSessionReducer,
} from './nav-session-state'

type NavSessionValue = {
  user: AuthUser | null
  status: NavSessionStatus
  pendingAction: NavSessionAction | null
  actionError: string | null
  refreshSession: () => Promise<void>
  signOut: () => Promise<boolean>
  signOutEverywhere: () => Promise<boolean>
}

const NavSessionContext = createContext<NavSessionValue | null>(null)

/** Shares auth session state between the site navigation and account pages.
 * @param apiMode Selects the live or mock auth source.
 * @param children Site content that consumes the session.
 */
export function NavSessionProvider({
  apiMode,
  children,
}: {
  apiMode: ApiMode
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, dispatch] = useReducer(navSessionReducer, initialNavSessionState)

  const refreshSession = useCallback(async () => {
    dispatch({ type: 'session-loading' })
    try {
      const session = await getAuthSource(apiMode).getSession()
      dispatch({ type: 'session-loaded', user: session?.user ?? null })
    } catch {
      dispatch({ type: 'session-unavailable' })
    }
  }, [apiMode])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const runLogoutAction = useCallback(
    async (action: NavSessionAction, execute: () => Promise<boolean>) => {
      dispatch({ type: 'action-started', action })
      const succeeded = await finishLogoutAction(execute, dispatch)
      if (succeeded) {
        router.refresh()
      }
      return succeeded
    },
    [router],
  )

  const signOut = useCallback(
    () =>
      runLogoutAction('signOut', async () => {
        const response = await getAuthSource(apiMode).signOut()
        return response.success
      }),
    [apiMode, runLogoutAction],
  )

  const signOutEverywhere = useCallback(
    () =>
      runLogoutAction('signOutEverywhere', async () => {
        await getAuthSource(apiMode).signOutEverywhere()
        return true
      }),
    [apiMode, runLogoutAction],
  )

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      pendingAction: state.pendingAction,
      actionError: state.actionError,
      refreshSession,
      signOut,
      signOutEverywhere,
    }),
    [state, refreshSession, signOut, signOutEverywhere],
  )
  return <NavSessionContext.Provider value={value}>{children}</NavSessionContext.Provider>
}

/** Reads the session state owned by the nearest site-level provider.
 * @returns The current user, session status, and shared auth actions.
 * @throws If rendered outside `NavSessionProvider`.
 */
export function useNavSession(): NavSessionValue {
  const value = useContext(NavSessionContext)
  if (!value) throw new Error('Nav session components must be inside NavSessionProvider')
  return value
}

export function NavSessionFeedback() {
  const { actionError } = useNavSession()
  if (!actionError) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4">
      <AuthStatusBanner variant="error">{actionError}</AuthStatusBanner>
    </div>
  )
}
