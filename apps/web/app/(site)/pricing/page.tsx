import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Gói thành viên',
  description: 'Gói Free và Pro của Luva UI. Giá Pro chưa chốt, chưa có thanh toán.',
}

const FREE_POINTS = [
  'Xem và xem trước mọi component.',
  'Cài các component gắn nhãn Free.',
  'Tài khoản mới từ email, Google hoặc GitHub là gói Free.',
] as const

const PRO_POINTS = [
  'Cài mọi component, gồm cả nhãn Pro, khi gói còn hiệu lực.',
  'Luôn lấy được bản mới nhất của component Pro trong thời gian đó.',
  'Hết hạn thì code đã cài vẫn chạy. Chỉ không cài thêm hoặc kéo bản Pro mới.',
] as const

export default function PricingPage() {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Gói thành viên</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Hai gói. Không mua từng component. Giá Pro chưa chốt, và trang này không thu tiền.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <li>
          <Card className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight">Free</h2>
              <p className="text-sm text-muted-foreground">Gói mặc định khi có tài khoản.</p>
            </div>
            <ul className="flex flex-col gap-2 text-sm leading-6">
              {FREE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Link href="/register" className={buttonClasses({ className: 'mt-auto w-fit' })}>
              Tạo tài khoản Free
            </Link>
          </Card>
        </li>
        <li>
          <Card className="flex h-full flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight">Pro</h2>
              <p className="text-sm text-muted-foreground">Quyền cài khi gói còn hiệu lực.</p>
            </div>
            <ul className="flex flex-col gap-2 text-sm leading-6">
              {PRO_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="mt-auto text-sm font-medium">Giá chưa chốt</p>
          </Card>
        </li>
      </ul>
    </section>
  )
}
