/**
 * Inline SVG icons — paths exported from the Figma file (icon/search 8:53,
 * Icon/Social X 118:1526, GitHub 118:1529, Mail 118:1533); menu/close are
 * local (Figma has no mobile frame). Decorative: they inherit `currentColor`
 * and are hidden from assistive tech, so the parent control carries the label.
 */
type IconProps = { className?: string }

export function IconSearch({ className = '' }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8.25 14.25C11.5637 14.25 14.25 11.5637 14.25 8.25C14.25 4.93629 11.5637 2.25 8.25 2.25C4.93629 2.25 2.25 4.93629 2.25 8.25C2.25 11.5637 4.93629 14.25 8.25 14.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.75 15.75L12.525 12.525"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSocialX({ className = '' }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M1 1L15 15M15 1L1 15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSocialGitHub({ className = '' }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 12.6668C2.66667 13.6668 2.66667 11.0001 1.33333 10.6668M10.6667 14.6668V12.0868C10.6917 11.7689 10.6487 11.4493 10.5407 11.1493C10.4326 10.8493 10.262 10.5757 10.04 10.3468C12.1333 10.1135 14.3333 9.32012 14.3333 5.68012C14.3332 4.74934 13.9751 3.85425 13.3333 3.18012C13.6372 2.36579 13.6157 1.46569 13.2733 0.666788C13.2733 0.666788 12.4867 0.433455 10.6667 1.65345C9.13867 1.23934 7.52799 1.23934 6 1.65345C4.18 0.433455 3.39333 0.666788 3.39333 0.666788C3.05092 1.46569 3.02943 2.36579 3.33333 3.18012C2.68675 3.85925 2.32835 4.76243 2.33333 5.70012C2.33333 9.31345 4.53333 10.1068 6.62667 10.3668C6.40733 10.5934 6.23817 10.8637 6.1302 11.1601C6.02223 11.4564 5.97787 11.7722 6 12.0868V14.6668"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSocialMail({ className = '' }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M13.5 3H2.5C1.67157 3 1 3.67157 1 4.5V11.5C1 12.3284 1.67157 13 2.5 13H13.5C14.3284 13 15 12.3284 15 11.5V4.5C15 3.67157 14.3284 3 13.5 3Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M1.5 4L8 9L14.5 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconMenu({ className = '' }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 6H17M3 10H17M3 14H17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconClose({ className = '' }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 5L15 15M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
