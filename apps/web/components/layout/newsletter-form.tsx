'use client'

/**
 * Newsletter field in the footer. The subscribe backend does not exist yet, so
 * submitting checks the address and then says plainly that nothing was saved.
 */
import { type FormEvent, useState } from 'react'
import { Button } from '../ui/button'
import { IconSearch } from '../ui/icons'
import { Input } from '../ui/input'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setMessage('Email không hợp lệ.')
      return
    }
    setMessage('Chức năng nhận tin đang được hoàn thiện. Email của bạn chưa được lưu.')
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring">
          <IconSearch className="shrink-0 text-muted-foreground" />
          <Input
            variant="bare"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Điền email của bạn"
            aria-label="Email"
            autoComplete="email"
          />
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        <Button type="submit" size="md">
          Đăng ký
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </form>
  )
}
