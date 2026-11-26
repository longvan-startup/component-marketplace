'use client'

/**
 * Sign-up form — client island for Figma "Đăng ký" (154:5839). The API
 * requires email verification, so a successful sign-up never signs the user
 * in: we show a "check your inbox" banner instead of redirecting.
 */
import { useEffect, useId, useState } from 'react'

const RESEND_COOLDOWN_SECONDS = 30

import { type ApiMode, AuthRequestError, getAuthSource } from '../../../features/auth/auth-source'
import {
  type FieldErrors,
  hasErrors,
  TERMS_REQUIRED_MESSAGE,
  validateEmail,
  validateName,
  validateNewPassword,
} from '../../../features/auth/form-validation'
import { verifyEmailCallbackUrl } from '../../../features/auth/safe-callback-url'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field } from '../../ui/field'
import { Input } from '../../ui/input'
import { AuthStatusBanner } from '../auth-status-banner'
import { focusFirstInvalid } from './focus-first-invalid'

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

type SignUpField = 'name' | 'email' | 'password' | 'terms'

type FormState = { kind: 'idle' | 'submitting' | 'done' | 'error'; message?: string }

export function SignUpForm({ apiMode }: { apiMode: ApiMode }) {
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<FieldErrors<SignUpField>>({})
  const termsId = useId()
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
    const found: FieldErrors<SignUpField> = {
      name: validateName(name),
      email: validateEmail(email),
      password: validateNewPassword(password),
      terms: agreed ? undefined : TERMS_REQUIRED_MESSAGE,
    }
    setErrors(found)
    if (hasErrors(found)) {
      /* the inputs are marked invalid on the next render, so look after it */
      requestAnimationFrame(() => focusFirstInvalid([nameId, emailId, passwordId, termsId]))
      return
    }
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Họ và tên" htmlFor={nameId} error={errors.name}>
        <Input
          id={nameId}
          type="text"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setErrors((prev) => ({ ...prev, name: undefined }))
          }}
          placeholder="Nguyễn Văn A"
        />
      </Field>
      <Field label="Email" htmlFor={emailId} error={errors.email}>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          placeholder="ban@email.com"
        />
      </Field>
      <Field label="Mật khẩu" htmlFor={passwordId} error={errors.password}>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          maxLength={128}
          aria-invalid={Boolean(errors.password)}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          placeholder="Tối thiểu 8 ký tự"
        />
      </Field>
      {state.kind === 'error' && (
        <AuthStatusBanner variant="error">{state.message}</AuthStatusBanner>
      )}
      <Checkbox
        id={termsId}
        checked={agreed}
        error={errors.terms}
        onChange={(event) => {
          setAgreed(event.target.checked)
          setErrors((prev) => ({ ...prev, terms: undefined }))
        }}
        label="Đồng ý Điều khoản và Chính sách bảo mật"
      />
      <Button type="submit" size="lg" className="w-full" loading={state.kind === 'submitting'}>
        Tạo tài khoản
      </Button>
    </form>
  )
}
