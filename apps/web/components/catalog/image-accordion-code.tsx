'use client'

import type { RegistryResponse } from '@marketplace/shared'
import { useState } from 'react'

const USAGE_EXAMPLE = `import { ImageAccordion } from './image-accordion'
import './image-accordion.css'

const items = [
  { name: 'Ảnh thứ nhất', src: '/images/first.jpg', alt: 'Mô tả ảnh thứ nhất' },
  { name: 'Ảnh thứ hai', src: '/images/second.jpg', alt: 'Mô tả ảnh thứ hai' },
]

export function Example() {
  return <ImageAccordion items={items} open={50} reach={35} bounce={10} gap={8} />
}`

/** Shows versioned registry source files and copies the selected file. */
export function ImageAccordionCode({
  release,
  liveMode,
}: {
  release: RegistryResponse['item'] | null
  liveMode: boolean
}) {
  const defaultPath =
    release?.files.find((file) => file.path.endsWith('.tsx'))?.path ??
    release?.files[0]?.path ??
    'usage-example.tsx'
  const [path, setPath] = useState(defaultPath)
  const [copyStatus, setCopyStatus] = useState('')

  const selectedFile = release?.files.find((file) => file.path === path)
  const source = selectedFile?.content ?? USAGE_EXAMPLE

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source)
      setCopyStatus('Đã sao chép')
    } catch {
      setCopyStatus('Không thể sao chép')
    }
  }

  return (
    <div className="flex min-h-[390px] flex-col rounded-xl border border-white/10 bg-black/25 p-3 sm:min-h-[520px] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            Tệp
            <select
              aria-label="Tệp source"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              className="min-h-11 rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {release?.files.map((file) => (
                <option key={file.path} value={file.path}>
                  {file.path}
                </option>
              ))}
              {!release ? <option value="usage-example.tsx">usage-example.tsx</option> : null}
            </select>
          </label>
          {release ? (
            <span className="font-mono text-xs text-zinc-400">v{release.version}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void copySource()}
          className="min-h-11 rounded-md border border-white/15 px-3 text-xs text-zinc-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          {release ? 'Sao chép tệp' : 'Sao chép ví dụ'}
        </button>
      </div>
      {copyStatus ? (
        <p role="status" className="mt-2 text-xs text-zinc-300">
          {copyStatus}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-zinc-400">
        {release
          ? 'Source lấy từ release Free đã đăng ký trong component_releases và component_release_files.'
          : liveMode
            ? 'Không tải được source release từ API. Hãy thử lại sau hoặc báo lỗi.'
            : 'Ví dụ dùng thử. Source release sẽ tải từ API khi mở Catalog ở chế độ live.'}
      </p>
      <pre className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-black/35 p-4 font-mono text-xs leading-6 text-zinc-200 sm:p-5">
        <code>{source}</code>
      </pre>
    </div>
  )
}
