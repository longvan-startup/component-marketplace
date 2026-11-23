import { describe, expect, test } from 'bun:test'
import {
  hasErrors,
  MIN_PASSWORD_LENGTH,
  validateCurrentPassword,
  validateEmail,
  validateName,
  validateNewPassword,
} from './form-validation'

describe('form validation messages', () => {
  test('a name must not be blank', () => {
    expect(validateName('')).toBe('Vui lòng nhập họ và tên.')
    expect(validateName('   ')).toBe('Vui lòng nhập họ và tên.')
    expect(validateName('Nguyễn Văn A')).toBeUndefined()
  })

  test('an email must be present and shaped like one', () => {
    expect(validateEmail('')).toBe('Vui lòng nhập email.')
    expect(validateEmail('  ')).toBe('Vui lòng nhập email.')
    expect(validateEmail('ban@')).toBe('Email không hợp lệ.')
    expect(validateEmail('ban@email')).toBe('Email không hợp lệ.')
    expect(validateEmail('ban email@x.com')).toBe('Email không hợp lệ.')
    expect(validateEmail(' ban@email.com ')).toBeUndefined()
  })

  test('a new password needs the minimum length', () => {
    expect(validateNewPassword('')).toBe('Vui lòng nhập mật khẩu.')
    expect(validateNewPassword('1234567')).toBe(
      `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`,
    )
    expect(validateNewPassword('12345678')).toBeUndefined()
  })

  test('a password for signing in only has to be filled', () => {
    expect(validateCurrentPassword('')).toBe('Vui lòng nhập mật khẩu.')
    expect(validateCurrentPassword('x')).toBeUndefined()
  })

  test('hasErrors ignores fields without a message', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ email: undefined })).toBe(false)
    expect(hasErrors({ email: undefined, name: 'x' })).toBe(true)
  })
})
