'use client'

import { changePasswordRequestSchema } from '@marketplace/shared'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { type ApiMode, AuthRequestError, getAuthSource } from '../../features/auth/auth-source'
import {
  type FieldErrors,
  hasErrors,
  validateNewPassword,
} from '../../features/auth/form-validation'
import { useNavSession } from '../layout/nav-session'
import { Button, buttonClasses } from '../ui/button'
import { Card } from '../ui/card'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { AuthStatusBanner } from './auth-status-banner'
import { focusFirstInvalid } from './focus-first-invalid'

type PasswordField = 'current' | 'new' | 'confirm'

function passwordChangeError(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.code === 'INVALID_PASSWORD') return 'Mật khẩu hiện tại không đúng.'
    if (error.code === 'PASSWORD_TOO_SHORT') return 'Mật khẩu mới cần có ít nhất 8 ký tự.'
    if (error.code === 'PASSWORD_TOO_LONG') return 'Mật khẩu mới không được dài quá 128 ký tự.'
  }
  return 'Không thể đổi mật khẩu. Vui lòng thử lại.'
}

export function SecuritySettings({ apiMode }: { apiMode: ApiMode }) {
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const confirmPasswordId = useId()
  const { user, status, pendingAction, refreshSession, signOutEverywhere } = useNavSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors<PasswordField>>({})
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [confirmingSignOutEverywhere, setConfirmingSignOutEverywhere] = useState(false)
  const [signedOutEverywhere, setSignedOutEverywhere] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }, [status])

  async function submitPasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordChanged(false)

    const found: FieldErrors<PasswordField> = {
      current: currentPassword ? undefined : 'Vui lòng nhập mật khẩu hiện tại.',
      new: validateNewPassword(newPassword),
      confirm: !confirmPassword
        ? 'Vui lòng nhập lại mật khẩu mới.'
        : newPassword !== confirmPassword
          ? 'Mật khẩu xác nhận chưa khớp.'
          : undefined,
    }
    setErrors(found)
    if (hasErrors(found)) {
      requestAnimationFrame(() =>
        focusFirstInvalid([currentPasswordId, newPasswordId, confirmPasswordId]),
      )
      return
    }
    const request = changePasswordRequestSchema.safeParse({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (!request.success) {
      setPasswordError('Mật khẩu mới cần dài từ 8 đến 128 ký tự.')
      return
    }

    setPasswordSubmitting(true)
    try {
      await getAuthSource(apiMode).changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordChanged(true)
    } catch (error) {
      setPasswordError(passwordChangeError(error))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  async function confirmSignOutEverywhere() {
    const succeeded = await signOutEverywhere()
    if (succeeded) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSignedOutEverywhere(true)
      setConfirmingSignOutEverywhere(false)
    }
  }

  if (status === 'loading') {
    return <AuthStatusBanner variant="info">Đang kiểm tra phiên đăng nhập…</AuthStatusBanner>
  }

  if (status === 'unavailable') {
    return (
      <div className="flex flex-col items-start gap-4">
        <AuthStatusBanner variant="error">
          Chưa thể kiểm tra trạng thái đăng nhập. Thử tải lại trước khi tiếp tục.
        </AuthStatusBanner>
        <Button variant="secondary" className="min-h-11" onClick={() => void refreshSession()}>
          Thử lại
        </Button>
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="flex flex-col items-start gap-4 p-5 sm:p-6">
        {signedOutEverywhere ? (
          <AuthStatusBanner variant="success">Đã đăng xuất khỏi mọi thiết bị.</AuthStatusBanner>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Đăng nhập để đổi mật khẩu hoặc kết thúc các phiên đang hoạt động.
        </p>
        <Link
          href="/login"
          className={buttonClasses({ variant: 'primary', size: 'md', className: 'min-h-11' })}
        >
          Đăng nhập
        </Link>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <section aria-labelledby="change-password-heading">
          <header className="mb-5">
            <h2 id="change-password-heading" className="text-lg font-semibold tracking-tight">
              Đổi mật khẩu
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Đổi mật khẩu sẽ giữ phiên trên thiết bị này và yêu cầu đăng nhập lại trên các thiết bị
              khác.
            </p>
          </header>

          <form onSubmit={submitPasswordChange} noValidate className="flex flex-col gap-5">
            <Field label="Mật khẩu hiện tại" htmlFor={currentPasswordId} error={errors.current}>
              <Input
                id={currentPasswordId}
                type="password"
                autoComplete="current-password"
                maxLength={128}
                disabled={passwordSubmitting || pendingAction !== null}
                aria-invalid={Boolean(errors.current)}
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, current: undefined }))
                }}
              />
            </Field>
            <Field
              label="Mật khẩu mới"
              htmlFor={newPasswordId}
              hint="Từ 8 đến 128 ký tự."
              error={errors.new}
            >
              <Input
                id={newPasswordId}
                type="password"
                autoComplete="new-password"
                maxLength={128}
                disabled={passwordSubmitting || pendingAction !== null}
                aria-invalid={Boolean(errors.new)}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, new: undefined }))
                }}
              />
            </Field>
            <Field label="Xác nhận mật khẩu mới" htmlFor={confirmPasswordId} error={errors.confirm}>
              <Input
                id={confirmPasswordId}
                type="password"
                autoComplete="new-password"
                maxLength={128}
                disabled={passwordSubmitting || pendingAction !== null}
                aria-invalid={Boolean(errors.confirm)}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, confirm: undefined }))
                }}
              />
            </Field>
            {passwordError ? (
              <AuthStatusBanner variant="error">{passwordError}</AuthStatusBanner>
            ) : null}
            {passwordChanged ? (
              <AuthStatusBanner variant="success">
                Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.
              </AuthStatusBanner>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-fit"
              disabled={pendingAction !== null}
              loading={passwordSubmitting}
            >
              Đổi mật khẩu
            </Button>
          </form>
        </section>
      </Card>

      <Card className="p-5 sm:p-6">
        <section aria-labelledby="sign-out-everywhere-heading">
          <header className="mb-4">
            <h2 id="sign-out-everywhere-heading" className="text-lg font-semibold tracking-tight">
              Phiên đăng nhập
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Thao tác này kết thúc phiên trên mọi thiết bị, kể cả thiết bị hiện tại.
            </p>
          </header>
          {confirmingSignOutEverywhere ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm font-medium">Bạn muốn đăng xuất khỏi mọi thiết bị?</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="danger"
                  className="min-h-11"
                  disabled={passwordSubmitting || pendingAction !== null}
                  loading={pendingAction === 'signOutEverywhere'}
                  onClick={() => void confirmSignOutEverywhere()}
                >
                  Xác nhận đăng xuất
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11"
                  disabled={passwordSubmitting || pendingAction !== null}
                  onClick={() => setConfirmingSignOutEverywhere(false)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="danger"
              className="min-h-11"
              disabled={passwordSubmitting || pendingAction !== null}
              onClick={() => setConfirmingSignOutEverywhere(true)}
            >
              Đăng xuất mọi thiết bị
            </Button>
          )}
        </section>
      </Card>
    </div>
  )
}
