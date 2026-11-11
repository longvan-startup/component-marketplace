'use client'

/**
 * Sign-in form — client island for Figma "Đăng nhập" (154:6050). On success
 * Better Auth sets the session cookie; we go home and refresh so the NavBar
 * re-reads the session. Error text is chosen from the Better Auth `code`.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { type ApiMode, AuthRequestError, getAuthSource } from '../../features/auth/auth-source'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { AuthStatusBanner } from './auth-status-banner'

function signInErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.code === 'INVALID_EMAIL_OR_PASSWORD' || error.code === 'INVALID_EMAIL') {
      return 'Email hoặc mật khẩu không đúng.'
    }
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return 'Email chưa được xác minh. Kiểm tra hộp thư để lấy link xác minh.'
    }
  }
  return 'Có lỗi xảy ra, thử lại sau.'
}

export function SignInForm({ apiMode }: { apiMode: ApiMode }) {
  const router = useRouter()
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await getAuthSource(apiMode).signIn(email.trim(), password)
      router.push('/')
      router.refresh()
    } catch (caught) {
      setError(signInErrorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nhập mật khẩu"
        />
      </Field>
      <Link
        href="/forgot-password"
        className="-mt-2 w-fit self-end rounded-sm text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Quên mật khẩu?
      </Link>
      {error && <AuthStatusBanner variant="error">{error}</AuthStatusBanner>}
      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        Đăng nhập
      </Button>
    </form>
  )
}
