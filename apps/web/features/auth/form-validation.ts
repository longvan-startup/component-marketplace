/**
 * Client-side checks for the auth forms, with Vietnamese messages. The forms turn
 * off the browser's own validation bubble ("Please fill out this field.") and show
 * these under each field instead. They only catch the obvious mistakes before a
 * request is sent; the API still validates everything.
 */

export const MIN_PASSWORD_LENGTH = 8

/* Loose on purpose: something before and after one "@", and a dot in the domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const TERMS_REQUIRED_MESSAGE =
  'Vui lòng đồng ý Điều khoản và Chính sách bảo mật để tiếp tục.'

/** One message per field name; a field with no problem has no entry. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}

export function validateName(value: string): string | undefined {
  return value.trim() ? undefined : 'Vui lòng nhập họ và tên.'
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Vui lòng nhập email.'
  return EMAIL_PATTERN.test(email) ? undefined : 'Email không hợp lệ.'
}

/** A password being chosen: it must also be long enough. */
export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Vui lòng nhập mật khẩu.'
  return value.length < MIN_PASSWORD_LENGTH
    ? `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`
    : undefined
}

/** A password being typed to sign in: only that it is not empty. */
export function validateCurrentPassword(value: string): string | undefined {
  return value ? undefined : 'Vui lòng nhập mật khẩu.'
}
