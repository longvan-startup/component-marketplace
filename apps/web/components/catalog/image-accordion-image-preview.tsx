'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  ImageAccordion,
  type ImageAccordionItem,
  type ImageAccordionProps,
} from './image-accordion'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Chọn ảnh JPG, PNG hoặc WebP.'
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh vượt quá 5 MB.'
  return null
}

interface CardImage {
  src: string
  name: string
}

interface CardEdit {
  image?: CardImage
  message?: string
  error?: boolean
}

function revokeImage(urls: Map<number, string>, index: number) {
  const url = urls.get(index)
  if (url) URL.revokeObjectURL(url)
  urls.delete(index)
}

/** Lets visitors replace the sample for each accordion card using local image files. */
export function ImageAccordionImagePreview({
  items: samples,
  ...settings
}: Omit<ImageAccordionProps, 'items'> & { items: readonly ImageAccordionItem[] }) {
  const fieldId = useId()
  const [edits, setEdits] = useState<Partial<Record<number, CardEdit>>>({})
  const activeUrls = useRef(new Map<number, string>())
  const pendingUrls = useRef(new Map<number, string>())

  useEffect(() => {
    const active = activeUrls.current
    const pending = pendingUrls.current
    return () => {
      for (const index of active.keys()) revokeImage(active, index)
      for (const index of pending.keys()) revokeImage(pending, index)
    }
  }, [])

  function showMessage(index: number, message: string, error = false) {
    setEdits((current) => ({
      ...current,
      [index]: { ...current[index], message, error },
    }))
  }

  async function selectImage(index: number, file: File) {
    const pending = pendingUrls.current
    revokeImage(pending, index)

    const validationError = validateImageFile(file)
    if (validationError) {
      showMessage(index, validationError, true)
      return
    }

    const src = URL.createObjectURL(file)
    pending.set(index, src)
    showMessage(index, 'Đang đọc ảnh…')

    const candidate = new window.Image()
    candidate.src = src
    try {
      await candidate.decode()
    } catch {
      if (pending.get(index) === src) {
        revokeImage(pending, index)
        showMessage(index, 'Không đọc được ảnh này. Hãy chọn tệp khác.', true)
      }
      return
    }

    if (pending.get(index) !== src) return
    pending.delete(index)
    revokeImage(activeUrls.current, index)
    activeUrls.current.set(index, src)
    setEdits((current) => ({
      ...current,
      [index]: { image: { src, name: file.name }, message: 'Đã đổi ảnh.' },
    }))
  }

  function restoreImage(index: number) {
    revokeImage(pendingUrls.current, index)
    revokeImage(activeUrls.current, index)
    setEdits((current) => ({ ...current, [index]: { message: 'Đã khôi phục ảnh mẫu.' } }))
    document.getElementById(`${fieldId}-${index}`)?.focus()
  }

  const items = samples.map((sample, index) => {
    const image = edits[index]?.image
    return image
      ? { id: sample.id ?? sample.name, name: image.name, src: image.src, alt: image.name }
      : sample
  })

  return (
    <>
      <div className="flex min-h-[390px] items-center justify-center rounded-xl border border-white/10 bg-black/25 p-4 sm:min-h-[520px] sm:p-8">
        <div className="h-[min(460px,65svh)] min-h-[340px] w-full max-w-[440px]">
          <ImageAccordion
            items={items}
            prompt="Di chuột hoặc chọn một ảnh"
            countLabel="ảnh"
            {...settings}
          />
        </div>
      </div>
      <fieldset className="mt-5 min-w-0">
        <legend className="text-sm font-medium">Ảnh từng thẻ</legend>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh. Ảnh chỉ dùng trong phiên xem thử.
        </p>
        <ol className="mt-2 grid gap-x-5 sm:grid-cols-2">
          {samples.map((sample, index) => {
            const edit = edits[index]
            const inputId = `${fieldId}-${index}`
            return (
              <li
                key={sample.id ?? sample.name}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-t border-white/10 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {index + 1}. {sample.name}
                  </p>
                  <p className="truncate text-xs text-zinc-400" title={edit?.image?.name}>
                    {edit?.image?.name ?? 'Ảnh mẫu'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <input
                    id={inputId}
                    type="file"
                    accept={IMAGE_TYPES.join(',')}
                    aria-label={`Đổi ảnh thẻ ${index + 1}: ${sample.name}`}
                    aria-describedby={`${inputId}-status`}
                    className="peer sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ''
                      if (file) void selectImage(index, file)
                    }}
                  />
                  <label
                    htmlFor={inputId}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-zinc-100 hover:bg-white/10 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300"
                  >
                    Đổi ảnh
                  </label>
                  {edit?.image ? (
                    <button
                      type="button"
                      aria-label={`Khôi phục ảnh mẫu cho thẻ ${index + 1}: ${sample.name}`}
                      className="min-h-11 rounded-md px-2 text-xs text-zinc-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                      onClick={() => restoreImage(index)}
                    >
                      Ảnh mẫu
                    </button>
                  ) : null}
                </div>
                <p
                  id={`${inputId}-status`}
                  role="status"
                  className={edit?.error ? 'col-span-2 text-xs text-red-300' : 'sr-only'}
                >
                  {edit?.message}
                </p>
              </li>
            )
          })}
        </ol>
      </fieldset>
    </>
  )
}
