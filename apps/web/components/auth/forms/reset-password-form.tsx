'use client'

/**
 * Reset-password form — client island. The page (Server Component) already
 * read `token`/`error` from its own query string (Better Auth's GET
 * `/reset-password/:token` callback put them there — see
 * apps/api/AUTH.md); this component only drives the POST submit + states.
 */
import { useId, useState } from 'react'
import { type ApiMode, getAuthSource, ResetPasswordError } from '../../../features/auth/auth-source'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../../features/auth/form-validation'
import { Button } from '../../ui/button'
import { Field } from '../../ui/field'
import { Input } from '../../ui/input'
import { AuthStatusBanner } from '../auth-status-banner'

type FormState = { kind: 'idle' | 'submitting' | 'done' | 'error'; message?: string }

export function ResetPasswordForm({ token, apiMode }: { token: string; apiMode: ApiMode }) {
  const passwordId = useId()
  const [password, setPassword] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [passwordError, setPasswordError] = useState<string | undefined>()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateNewPassword(password)
    setPasswordError(found)
    if (found) {
      requestAnimationFrame(() => document.getElementById(passwordId)?.focus())
      return
    }
    setState({ kind: 'submitting' })
    try {
      await getAuthSource(apiMode).resetPassword(token, password)
      setState({ kind: 'done' })
    } catch (error) {
      if (error instanceof ResetPasswordError && error.code === 'INVALID_TOKEN') {
        setState({
          kind: 'error',
          message: 'Link đã hết hạn hoặc không hợp lệ — yêu cầu link mới ở trang quên mật khẩu.',
        })
        return
      }
      if (error instanceof ResetPasswordError && error.code === 'PASSWORD_TOO_SHORT') {
        setState({
          kind: 'error',
          message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
        })
        return
      }
      setState({ kind: 'error', message: 'Có lỗi xảy ra, thử lại sau.' })
    }
  }

  if (state.kind === 'done') {
    return (
      <AuthStatusBanner variant="success">
        Đặt lại mật khẩu thành công. Các thiết bị khác đã đăng xuất — đăng nhập lại bằng mật khẩu
        mới.
      </AuthStatusBanner>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Mật khẩu mới" htmlFor={passwordId} error={passwordError}>
        <Input
          id={passwordId}
          type="password"
          aria-invalid={Boolean(passwordError)}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setPasswordError(undefined)
          }}
          placeholder="Ít nhất 8 ký tự"
        />
      </Field>
      {state.kind === 'error' && (
        <AuthStatusBanner variant="error">{state.message}</AuthStatusBanner>
      )}
      <Button type="submit" loading={state.kind === 'submitting'}>
        Đặt lại mật khẩu
      </Button>
    </form>
  )
}
