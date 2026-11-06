'use client'

/**
 * Resend-verification form — client island. Standalone entry point: there's
 * no login/signup UI yet (apps/api/AUTH.md "Out of scope"), so this is the
 * only way a user can request a fresh verification link today, besides the
 * automatic resend Better Auth fires on a blocked sign-in (`sendOnSignIn`).
 */
import { useId, useState } from 'react'
import { type ApiMode, getAuthSource } from '../../features/auth/auth-source'
import { verifyEmailCallbackUrl } from '../../features/auth/safe-callback-url'
import { Button } from '../ui/button'
import { AuthStatusBanner } from './auth-status-banner'

type FormState = { kind: 'idle' | 'submitting' | 'done' | 'error'; message?: string }

export function ResendVerificationForm({ apiMode }: { apiMode: ApiMode }) {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ kind: 'submitting' })
    try {
      await getAuthSource(apiMode).resendVerificationEmail(email.trim(), verifyEmailCallbackUrl())
      setState({
        kind: 'done',
        message: 'Nếu email tồn tại và chưa xác minh, kiểm tra hộp thư để lấy link mới.',
      })
    } catch {
      // Non-leaking by design server-side — a thrown error here is only a
      // real network/server failure, never "email not found".
      setState({ kind: 'error', message: 'Có lỗi xảy ra, thử lại sau.' })
    }
  }

  if (state.kind === 'done') {
    return <AuthStatusBanner variant="success">{state.message}</AuthStatusBanner>
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="text-sm font-medium">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ban@vidu.com"
          className="min-h-11 w-full rounded-card border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {state.kind === 'error' && (
        <AuthStatusBanner variant="error">{state.message}</AuthStatusBanner>
      )}
      <Button type="submit" loading={state.kind === 'submitting'}>
        Gửi lại link xác minh
      </Button>
    </form>
  )
}
