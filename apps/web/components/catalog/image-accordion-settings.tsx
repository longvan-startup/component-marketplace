'use client'

import Link from 'next/link'

export const DEFAULT_ACCORDION_SETTINGS = { open: 50, reach: 35, bounce: 10, gap: 8 }
export type AccordionSettings = typeof DEFAULT_ACCORDION_SETTINGS

function RangeControl({
  label,
  min,
  max,
  value,
  suffix = '',
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

/** Exposes the preview's motion and spacing settings. */
export function ImageAccordionSettings({
  values,
  onChange,
  onReset,
  version,
  releaseAvailable,
  sourceMode,
  useNarutoSamples,
}: {
  values: AccordionSettings
  onChange: (key: keyof AccordionSettings, value: number) => void
  onReset: () => void
  version: string
  releaseAvailable: boolean
  sourceMode: 'mock' | 'live'
  useNarutoSamples: boolean
}) {
  return (
    <aside className="flex flex-col gap-6 border-t border-border bg-card p-5 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Image accordion</h2>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 rounded-badge px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Đặt lại
        </button>
      </div>
      <div className="flex flex-col gap-5">
        <RangeControl
          label="Open"
          min={20}
          max={80}
          value={values.open}
          suffix="%"
          onChange={(value) => onChange('open', value)}
        />
        <RangeControl
          label="Reach"
          min={0}
          max={100}
          value={values.reach}
          onChange={(value) => onChange('reach', value)}
        />
        <RangeControl
          label="Bounce"
          min={0}
          max={20}
          value={values.bounce}
          onChange={(value) => onChange('bounce', value)}
        />
        <RangeControl
          label="Gap"
          min={0}
          max={20}
          value={values.gap}
          suffix="px"
          onChange={(value) => onChange('gap', value)}
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Di chuột hoặc chọn ảnh để mở rộng. Dùng phím mũi tên, Home và End khi focus vào gallery.
      </p>
      <div className="mt-auto border-t border-border pt-5">
        <p className="text-sm font-medium">Bản Free · v{version}</p>
        <dl className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-5">
          <dt className="text-muted-foreground">License</dt>
          <dd>MIT</dd>
          <dt className="text-muted-foreground">Runtime</dt>
          <dd>React 19 · CSS</dd>
          <dt className="text-muted-foreground">Source</dt>
          <dd>
            {releaseAvailable
              ? 'Đã tải từ registry'
              : sourceMode === 'live'
                ? 'API chưa trả source'
                : 'Mở API_MODE=live'}
          </dd>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <Link
            href="https://bencho.dev/blocks/image-accordion"
            target="_blank"
            rel="noreferrer"
            className="min-h-11 inline-flex items-center text-primary underline-offset-4 hover:underline"
          >
            Mở trang tham chiếu Bencho
          </Link>
          {useNarutoSamples ? (
            <a
              href="https://naruto-official.com/en/special/wallpaper"
              target="_blank"
              rel="noreferrer"
              className="min-h-11 inline-flex items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Nguồn ảnh Naruto
            </a>
          ) : null}
        </div>
        {useNarutoSamples ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Ảnh Naruto chỉ dùng trong preview phát triển, không nằm trong release. Preview
            production dùng ảnh mẫu gốc của marketplace.
          </p>
        ) : null}
      </div>
    </aside>
  )
}
