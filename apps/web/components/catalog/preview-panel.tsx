'use client'

/**
 * Preview panel — proof that animation-owned surfaces live behind a single
 * client island while the page stays a Server Component. Motion is pure CSS
 * keyframes, disabled under prefers-reduced-motion (motion-reduce variant);
 * no GSAP/framer-motion until a real use case says otherwise.
 */
export function PreviewPanel({ componentName }: { componentName: string }) {
  return (
    <figure
      aria-label={`${componentName} animation preview`}
      className="flex min-h-32 items-center justify-center rounded-card border border-border bg-muted p-6"
    >
      <div className="flex items-end gap-2">
        <span className="inline-block h-10 w-10 rounded-card bg-primary motion-safe:animate-bounce" />
        <span
          className="inline-block h-10 w-16 rounded-card bg-foreground/80 motion-safe:animate-pulse"
          style={{ animationDelay: '150ms' }}
        />
        <span className="inline-block h-10 w-6 rounded-card bg-accent motion-safe:animate-bounce [animation-direction:reverse]" />
      </div>
    </figure>
  )
}
