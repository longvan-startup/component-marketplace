import { redirect } from 'next/navigation'

/* Trang /verify-email không còn là đích của link xác minh (xem
   verifyEmailCallbackUrl → /verify-email/success). Truy cập trực tiếp thì
   đưa người dùng về đăng nhập. */
export default function VerifyEmailPage() {
  redirect('/login')
}
