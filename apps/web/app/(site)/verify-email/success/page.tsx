import type { Metadata } from 'next'
import { VerifyEmailResult } from '@/components/auth/verify-email-result'

export const metadata: Metadata = {
  title: 'Xác minh email',
}

interface VerifyEmailSuccessPageProps {
  searchParams: Promise<{ error?: string | string[] }>
}

/* Đích redirect của Better Auth sau khi bấm link xác minh (callbackURL =
   verifyEmailCallbackUrl()). Thành công: API đã đặt cookie phiên và URL không
   có tham số. Thất bại: URL có ?error=... (apps/api/AUTH.md). */
export default async function VerifyEmailSuccessPage({
  searchParams,
}: VerifyEmailSuccessPageProps) {
  const params = await searchParams
  return <VerifyEmailResult failed={params.error !== undefined} />
}
