/** The Vietnamese wording of the auth emails, kept apart from their layout. */

export type AuthEmailKind = 'verification' | 'password-reset'

export const BRAND_NAME = 'Luva UI'

/** How long a verification or reset link stays valid, in minutes. config.ts uses it
 * for the token lifetimes too, so the email never promises a different time. */
export const AUTH_LINK_TTL_MINUTES = 15

export type AuthEmailCopy = {
  subject: string
  /** Two lines, broken as in the layout. */
  heading: [string, string]
  intro: string
  button: string
  perksTitle: string
  /** Four items, filled left to right, top to bottom. */
  perks: { title: string; body: string }[]
  note: string
}

export const COPY: Record<AuthEmailKind, AuthEmailCopy> = {
  verification: {
    subject: `Xác minh email tài khoản ${BRAND_NAME}`,
    heading: ['Xác minh email', 'của bạn.'],
    intro: `cảm ơn bạn đã đăng ký ${BRAND_NAME}. Bấm nút bên dưới để xác minh email và bắt đầu dùng tài khoản.`,
    button: 'Xác minh email',
    perksTitle: 'Sau khi xác minh, bạn có thể:',
    perks: [
      { title: 'Khám phá component.', body: 'Xem mô tả và phiên bản đã publish.' },
      { title: 'Lọc theo danh mục.', body: 'Đến nhanh đúng loại bạn cần.' },
      { title: 'Xem demo trực tiếp.', body: 'Chạy thử ngay trên trang.' },
      { title: 'Tìm nhanh.', body: 'Gõ từ khóa là thấy component.' },
    ],
    note: 'Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.',
  },
  'password-reset': {
    subject: `Đặt lại mật khẩu ${BRAND_NAME}`,
    heading: ['Đặt lại', 'mật khẩu.'],
    intro:
      'chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để chọn mật khẩu mới.',
    button: 'Đặt lại mật khẩu',
    perksTitle: 'Lưu ý khi đổi mật khẩu:',
    perks: [
      { title: 'Mật khẩu mới.', body: 'Từ 8 đến 128 ký tự.' },
      { title: 'Phiên cũ bị đăng xuất.', body: 'Mọi phiên đăng nhập cũ bị thu hồi.' },
      { title: 'Hết hạn nhanh.', body: 'Quá hạn thì yêu cầu link mới.' },
      { title: 'Không chia sẻ link.', body: 'Không gửi link này cho bất kỳ ai.' },
    ],
    note: 'Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.',
  },
}
