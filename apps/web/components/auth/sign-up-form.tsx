'use client'

/**
 * Sign-up form — client island for Figma "Đăng ký" (154:5839). The API
 * requires email verification, so a successful sign-up never signs the user
 * in: we show a "check your inbox" banner instead of redirecting.
 */
import { useEffect, useId, useState } from 'react'

const RESEND_COOLDOWN_SECONDS = 30

import { type ApiMode, AuthRequestError, getAuthSource } from '../../features/auth/auth-source'
import { verifyEmailCallbackUrl } from '../../features/auth/safe-callback-url'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { AuthStatusBanner } from './auth-status-banner'

function signUpErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.code?.startsWith('USER_ALREADY_EXISTS')) {
      return 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.'
    }
    if (error.code === 'INVALID_EMAIL') return 'Email không hợp lệ.'
    if (error.code === 'PASSWORD_TOO_SHORT') return 'Mật khẩu cần tối thiểu 8 ký tự.'
    if (error.code === 'PASSWORD_TOO_LONG') return 'Mật khẩu tối đa 128 ký tự.'
  }
  return 'Có lỗi xảy ra, thử lại sau.'
}

type FormState = { kind: 'idle' | 'submitting' | 'done' | 'error'; message?: string }

export function SignUpForm({ apiMode }: { apiMode: ApiMode }) {
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [cooldown, setCooldown] = useState(0)

  // Đếm ngược 30 giây sau mỗi lần bấm gửi lại, để tránh spam email.
  useEffect(() => {
    if (cooldown === 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function resendLink() {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setResend('sending')
    try {
      await getAuthSource(apiMode).resendVerificationEmail(email.trim(), verifyEmailCallbackUrl())
      setResend('sent')
    } catch {
      setResend('error')
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ kind: 'submitting' })
    try {
      await getAuthSource(apiMode).signUp(
        { name: name.trim(), email: email.trim(), password },
        verifyEmailCallbackUrl(),
      )
      setState({ kind: 'done' })
    } catch (caught) {
      setState({ kind: 'error', message: signUpErrorMessage(caught) })
    }
  }

  if (state.kind === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <AuthStatusBanner variant="success">
          {apiMode === 'live'
            ? `Tài khoản đã được tạo. Kiểm tra hộp thư ${email.trim()} và bấm link xác minh trước khi đăng nhập.`
            : 'Chế độ demo: chưa có tài khoản thật và không có email nào được gửi đi.'}
        </AuthStatusBanner>
        {apiMode === 'live' && (
          <>
            <Button
              variant="secondary"
              loading={resend === 'sending'}
              disabled={cooldown > 0}
              onClick={resendLink}
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown} giây` : 'Gửi lại email xác minh'}
            </Button>
            {resend === 'sent' && (
              <p className="text-center text-xs text-muted-foreground">
                Đã gửi lại (nếu email chưa xác minh).
              </p>
            )}
            {resend === 'error' && (
              <AuthStatusBanner variant="error">Có lỗi xảy ra, thử lại sau.</AuthStatusBanner>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="Họ và tên" htmlFor={nameId}>
        <Input
          id={nameId}
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nguyễn Văn A"
        />
      </Field>
      <Field label="Email" htmlFor={emailId}>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ban@email.com"
        />
      </Field>
      <Field label="Mật khẩu" htmlFor={passwordId}>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Tối thiểu 8 ký tự"
        />
      </Field>
      {state.kind === 'error' && (
        <AuthStatusBanner variant="error">{state.message}</AuthStatusBanner>
      )}
      <Button type="submit" size="lg" className="w-full" loading={state.kind === 'submitting'}>
        Tạo tài khoản
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
      </p>
    </form>
  )
}
