/**
 * Typed HTTP client for `apps/web` — the single channel to the backend.
 *
 * Rules encoded here (see apps/web/AGENTS.md + the shared contract proposal):
 * - The web app NEVER imports backend/db code; everything crosses HTTP.
 * - The API base URL differs per runtime, and it is never hardcoded to a
 *   host (localhost included). Resolution order:
 *     · browser (`runtime: 'browser'`)      → NEXT_PUBLIC_API_URL, else the
 *       same-origin `/api` path (the public rewrite into the api service in
 *       the Vercel Services layout — see root vercel.json).
 *     · Next server runtime (`'server'`)    → API_URL_INTERNAL (injected by
 *       the `web` service binding in vercel.json) → NEXT_PUBLIC_API_URL →
 *       same-origin `/api` fallback.
 * - Secrets never go through this client; it only reads non-secret config.
 */

/** Runtime the request is issued from (decides which base URL applies). */
export type ApiRuntime = 'browser' | 'server'

/**
 * Same-origin default when no explicit URL is configured. This matches the
 * public rewrite `/api/(.*)` → api service (`vercel.json`), so a Vercel
 * deployment with zero env config still reaches the api over the public
 * surface. Relative on purpose (browser) — SSR callers get the internal
 * binding URL first.
 */
export const DEFAULT_API_BASE = '/api'

interface BaseUrlConfig {
  publicApiUrl: string | undefined
  internalApiUrl: string | undefined
}

/**
 * Resolve the API base origin for a runtime. Exported for tests + reuse;
 * `apiFetch` calls it automatically.
 */
export function resolveApiBaseUrl(
  runtime: ApiRuntime,
  config: BaseUrlConfig = {
    publicApiUrl: process.env.NEXT_PUBLIC_API_URL,
    internalApiUrl: process.env.API_URL_INTERNAL,
  },
): string {
  if (runtime === 'server' && config.internalApiUrl) return config.internalApiUrl
  return config.publicApiUrl ?? DEFAULT_API_BASE
}

/** Normalized error for every non-2xx response or network failure. */
export class ApiClientError extends Error {
  readonly status: number
  readonly path: string

  constructor(path: string, status: number, message: string) {
    super(`GET ${path} failed (${status}): ${message}`)
    this.name = 'ApiClientError'
    this.status = status
    this.path = path
  }
}

const DEFAULT_TIMEOUT_MS = 10_000

interface FetchJsonOptions {
  /** Explicit runtime override; defaults to server when no DOM exists. */
  runtime?: ApiRuntime
  fetchImpl?: typeof fetch
  timeoutMs?: number
  publicApiUrl?: string
  internalApiUrl?: string
}

/** Typed JSON GET with normalized errors. POST/PUT arrive with real endpoints. */
export async function apiFetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const runtime: ApiRuntime =
    options.runtime ?? (typeof window === 'undefined' ? 'server' : 'browser')
  const base = resolveApiBaseUrl(runtime, {
    publicApiUrl: options.publicApiUrl ?? process.env.NEXT_PUBLIC_API_URL,
    internalApiUrl: options.internalApiUrl ?? process.env.API_URL_INTERNAL,
  })
  const url = `${base.replace(/\/$/, '')}${path}`
  const doFetch = options.fetchImpl ?? fetch

  let response: Response
  try {
    response = await doFetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    throw new ApiClientError(path, 0, error instanceof Error ? error.message : 'network error')
  }

  if (!response.ok) {
    throw new ApiClientError(path, response.status, response.statusText || 'request failed')
  }
  return (await response.json()) as T
}
