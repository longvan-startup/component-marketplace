'use client'

import { useEffect } from 'react'

/* Last line of defence: replaces the root layout when the layout itself fails,
   so it cannot use the layout's styles or fonts. Keep it self-contained. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          background: '#fafafa',
          color: '#18181b',
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Có lỗi xảy ra</h1>
        <p style={{ margin: 0, color: '#52525b' }}>Trang chưa tải được. Bạn thử lại sau ít phút.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: 48,
            padding: '0 24px',
            borderRadius: 9999,
            border: 0,
            background: '#7c3aed',
            color: '#ffffff',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Thử lại
        </button>
      </body>
    </html>
  )
}
