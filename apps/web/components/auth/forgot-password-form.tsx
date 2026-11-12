'use client'

/**
 * Forgot-password form — client island (needs submit state). Renders the
 * exact same generic message regardless of whether the email exists, which
 * `createHttpAuthSource` already gets for free from Better Auth's own
 * non-leaking response (see features/auth/auth-source.ts) — this component
 * never has to decide what to hide.
 */
import { useId, useState } from 'react'
import { type ApiMode, getAuthSource } from '../../features/auth/auth-source'
import { resetPasswordCallbackUrl } from '../../features/auth/safe-callback-url'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { AuthStatusBanner } from './auth-status-banner'

type FormState = { kind: 'idle' | 'submitting' | 'done' | 'error'; message?: string }

export function ForgotPasswordForm({ apiMode }: { apiMode: ApiMode }) {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ kind: 'submitting' })
    try {
      const result = await getAuthSource(apiMode).requestPasswordReset(
        email.trim(),
        resetPasswordCallbackUrl(),
      )
      setState({
        kind: 'done',
        message:
          result.message ?? 'Nếu email tồn tại, kiểm tra hộp thư để lấy link đặt lại mật khẩu.',
      })
    } catch {
      // Network/server failure only — the backend itself never reports
      // "email not found" as an error (non-leaking by design).
      setState({ kind: 'error', message: 'Có lỗi xảy ra, thử lại sau.' })
    }
  }

  if (state.kind === 'done') {
    return <AuthStatusBanner variant="success">{state.message}</AuthStatusBanner>
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Email" htmlFor={emailId}>
        <Input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ban@vidu.com"
        />
      </Field>
      {state.kind === 'error' && (
        <AuthStatusBanner variant="error">{state.message}</AuthStatusBanner>
      )}
      <Button type="submit" loading={state.kind === 'submitting'}>
        Gửi link đặt lại mật khẩu
      </Button>
    </form>
  )
}
