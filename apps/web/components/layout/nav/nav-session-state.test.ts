import { describe, expect, test } from 'bun:test'
import {
  finishLogoutAction,
  initialNavSessionState,
  navSessionReducer,
  SESSION_ACTION_ERROR,
} from './nav-session-state'

const USER = { id: 'u1', email: 'user@example.test', name: 'User', emailVerified: true }

describe('navigation auth session state', () => {
  test('a logout failure preserves the authenticated user and records a safe error', async () => {
    const authenticated = navSessionReducer(initialNavSessionState, {
      type: 'session-loaded',
      user: USER,
    })
    let state = navSessionReducer(authenticated, { type: 'action-started', action: 'signOut' })
    const succeeded = await finishLogoutAction(
      async () => false,
      (event) => {
        state = navSessionReducer(state, event)
      },
    )

    expect(succeeded).toBe(false)
    expect(state.user).toEqual(USER)
    expect(state.status).toBe('authenticated')
    expect(state.pendingAction).toBeNull()
    expect(state.actionError).toBe(SESSION_ACTION_ERROR)
  })

  test('a rejected logout request preserves the authenticated user', async () => {
    const authenticated = navSessionReducer(initialNavSessionState, {
      type: 'session-loaded',
      user: USER,
    })
    let state = navSessionReducer(authenticated, { type: 'action-started', action: 'signOut' })
    const succeeded = await finishLogoutAction(
      async () => {
        throw new Error('network unavailable')
      },
      (event) => {
        state = navSessionReducer(state, event)
      },
    )

    expect(succeeded).toBe(false)
    expect(state.user).toEqual(USER)
    expect(state.actionError).toBe(SESSION_ACTION_ERROR)
  })

  test('a confirmed logout clears the in-memory session', () => {
    const authenticated = navSessionReducer(initialNavSessionState, {
      type: 'session-loaded',
      user: USER,
    })
    const signedOut = navSessionReducer(authenticated, { type: 'action-succeeded' })

    expect(signedOut.user).toBeNull()
    expect(signedOut.status).toBe('guest')
    expect(signedOut.actionError).toBeNull()
  })
})
