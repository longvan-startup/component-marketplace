import type { AuthUser } from '@marketplace/shared'

export type NavSessionStatus = 'loading' | 'authenticated' | 'guest' | 'unavailable'
export type NavSessionAction = 'signOut' | 'signOutEverywhere'

export type NavSessionState = {
  user: AuthUser | null
  status: NavSessionStatus
  pendingAction: NavSessionAction | null
  actionError: string | null
}

export const initialNavSessionState: NavSessionState = {
  user: null,
  status: 'loading',
  pendingAction: null,
  actionError: null,
}

export const SESSION_ACTION_ERROR = 'Không thể đăng xuất. Vui lòng thử lại.'

export type NavSessionEvent =
  | { type: 'session-loading' }
  | { type: 'session-loaded'; user: AuthUser | null }
  | { type: 'session-unavailable' }
  | { type: 'action-started'; action: NavSessionAction }
  | { type: 'action-failed' }
  | { type: 'action-succeeded' }

export function navSessionReducer(state: NavSessionState, event: NavSessionEvent): NavSessionState {
  switch (event.type) {
    case 'session-loading':
      return { ...state, status: 'loading', actionError: null }
    case 'session-loaded':
      return {
        user: event.user,
        status: event.user ? 'authenticated' : 'guest',
        pendingAction: null,
        actionError: null,
      }
    case 'session-unavailable':
      return { ...state, user: null, status: 'unavailable', pendingAction: null }
    case 'action-started':
      return { ...state, pendingAction: event.action, actionError: null }
    case 'action-failed':
      return { ...state, pendingAction: null, actionError: SESSION_ACTION_ERROR }
    case 'action-succeeded':
      return {
        ...state,
        user: null,
        status: 'guest',
        pendingAction: null,
        actionError: null,
      }
  }
}

export async function finishLogoutAction(
  execute: () => Promise<boolean>,
  dispatch: (event: NavSessionEvent) => void,
): Promise<boolean> {
  try {
    if (!(await execute())) throw new Error('Logout was not confirmed')
    dispatch({ type: 'action-succeeded' })
    return true
  } catch {
    dispatch({ type: 'action-failed' })
    return false
  }
}
