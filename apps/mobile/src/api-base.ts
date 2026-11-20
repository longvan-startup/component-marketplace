/** Local API used when Expo Go is started without EXPO_PUBLIC_API_URL. */
export const DEV_API_BASE_URL = 'http://localhost:4000'

export function resolveApiBaseUrl(value: string | undefined): string {
  const candidate = value && value.length > 0 ? value : DEV_API_BASE_URL
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('API base URL must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API base URL must be an absolute http(s) URL')
  }
  return candidate.replace(/\/$/, '')
}
