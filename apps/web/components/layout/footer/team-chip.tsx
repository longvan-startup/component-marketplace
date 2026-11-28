'use client'

/**
 * "By Văn và Long" chip: the two GitHub avatars, then a link to the source.
 * The avatars are read from GitHub on every page load. After mount each URL gets
 * a timestamp, so the browser fetches it again instead of reusing its cache.
 * Before mount the plain URLs are used, so the server and client HTML match.
 */
import Image from 'next/image'
import { useEffect, useState } from 'react'

const TEAM = [
  // The first photo is shrunk inside its circle so the face is not too big.
  { login: 'DaoDungVan', photoClass: 'scale-75' },
  { login: 'NguyenTuMinhLong', photoClass: '' },
] as const

export function TeamChip({ href }: { href: string }) {
  const [stamp, setStamp] = useState<string | null>(null)

  useEffect(() => {
    setStamp(String(Date.now()))
  }, [])

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="By Văn và Long, mở mã nguồn trên GitHub"
      className="inline-flex items-center gap-3 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center">
        {TEAM.map((member, index) => (
          <span
            key={member.login}
            className={`relative block size-8 shrink-0 overflow-hidden rounded-full border-2 border-card bg-card ${index > 0 ? '-ml-2' : ''}`}
          >
            <Image
              src={`https://github.com/${member.login}.png?size=96${stamp ? `&t=${stamp}` : ''}`}
              alt=""
              fill
              sizes="32px"
              unoptimized
              className={`object-cover ${member.photoClass}`}
            />
          </span>
        ))}
      </span>
      <span>
        By <span className="font-medium text-foreground">Văn và Long</span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  )
}
