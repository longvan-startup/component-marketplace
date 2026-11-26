'use client'

import { usePathname } from 'next/navigation'
import { RouteFade } from '../route-fade'

/* The headline under the showcase cards. The showcase itself stays mounted across
   the auth pages, so only this text changes with the route. */
const COPY: Record<string, { title: string; subtitle: string }> = {
  '/login': {
    title: 'Chào mừng quay lại',
    subtitle: 'Tiếp tục khám phá các component UI trong thư viện.',
  },
  '/forgot-password': {
    title: 'Lấy lại quyền truy cập',
    subtitle: 'Nhập email để nhận link đặt lại mật khẩu.',
  },
  '/reset-password': {
    title: 'Sắp xong rồi',
    subtitle: 'Chọn một mật khẩu mới để tiếp tục với thư viện component UI.',
  },
  '/register': {
    title: 'Component UI chất lượng, sẵn dùng ngay',
    subtitle: 'Khám phá các component UI trong thư viện.',
  },
}
const FALLBACK = COPY['/register'] ?? { title: '', subtitle: '' }

export function ShowcaseCopy() {
  const copy = COPY[usePathname()] ?? FALLBACK
  return (
    <RouteFade className="flex w-[420px] max-w-full flex-col items-center gap-3 px-4 text-center text-white">
      <p className="text-3xl font-bold">{copy.title}</p>
      <p className="max-w-[380px] text-[15px] opacity-60">{copy.subtitle}</p>
    </RouteFade>
  )
}
