'use client'

/**
 * GSAP integration for `apps/web` — the ONLY entry point for animation.
 *
 * Rules encoded here (see apps/web/README.md § Animation — GSAP):
 * - Animations live in **client islands only** — never import `gsap` directly
 *   from a Server Component; mount an island that uses this hook instead.
 * - Every mount is scoped: tweens registered inside `setup` are created
 *   through `gsap.context()` and reverted on unmount (no leaked global
 *   listeners, no double-mount flicker in strict mode).
 * - `prefers-reduced-motion: reduce` short-circuits before any tween is
 *   created — accessibility is the default, not an opt-in.
 * - Plugins are NOT registered globally here. When a plugin is needed
 *   (e.g. ScrollTrigger…), register it inside the island with the same
 *   context/revert lifecycle — keeps the RSC bundle clean.
 *
 * Full onboarding guide: `apps/web/README.md`.
 */

import { gsap } from 'gsap'
import { type RefObject, useEffect, useRef } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * `true` when the user asked the OS to reduce motion. Server render → `true`
 * (SSR never runs tweens; the island takes over after hydration).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Tools handed to a `useGsapScope` setup callback. */
export interface GsapScopeApi {
  /** The full gsap core — entry, timeline, from/to, set… */
  gsap: typeof gsap
  /** Query ONE element strictly inside the island scope (or `null`). */
  q: <T extends Element = Element>(selector: string) => T | null
  /** Query ALL elements strictly inside the island scope. */
  qa: <T extends Element = Element>(selector: string) => T[]
  /** The scope root element the island is bound to. */
  scope: HTMLElement
}

/**
 * Bind a GSAP animation setup to a client island with automatic cleanup.
 *
 * `setup` runs ONCE after mount (client only). Anything created inside it —
 * tweens, timelines, event listeners added through `api.gsap` internals — is
 * reverted on unmount, so navigating away never leaves zombie tweens behind.
 * When the user prefers reduced motion, `setup` is never invoked at all.
 *
 * Usage (client island):
 *
 * ```tsx
 * 'use client'
 * import { useRef } from 'react'
 * import { useGsapScope } from '../../lib/gsap'
 *
 * export function HeroIsland() {
 *   const scopeRef = useRef<HTMLDivElement>(null)
 *   useGsapScope(scopeRef, ({ gsap, qa }) => {
 *     gsap.from(qa('.hero-line'), { y: 12, opacity: 0, stagger: 0.06 })
 *   })
 *   return <div ref={scopeRef}>…</div>
 * }
 * ```
 */
export function useGsapScope(
  scopeRef: RefObject<HTMLElement | null>,
  setup: (api: GsapScopeApi) => void,
): void {
  // Latest-ref pattern: parents may pass an inline arrow (new identity every
  // render) WITHOUT restarting animations — the effect below runs once per
  // mount and always invokes the most recent setup at that moment.
  const setupRef = useRef(setup)
  useEffect(() => {
    setupRef.current = setup
  }, [setup])

  useEffect(() => {
    const node = scopeRef.current
    if (!node) return

    // Accessibility first: no tween is ever created for reduced-motion users.
    if (prefersReducedMotion()) return

    const context = gsap.context(() => {
      setupRef.current({
        gsap,
        q: <T extends Element = Element>(selector: string): T | null =>
          node.querySelector<T>(selector),
        qa: <T extends Element = Element>(selector: string): T[] =>
          Array.from(node.querySelectorAll<T>(selector)),
        scope: node,
      })
    }, node)

    return () => {
      context.revert()
    }
    // Runs once per island mount — a changed setupREF identity only updates
    // what a future mount would run; a changed scopeRef re-binds cleanly.
  }, [scopeRef])
}
