type ProbeResult = { path: string; passed: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/** Check the empty catalog and missing slugs after the isolated database migrates. */
export async function probeCatalog(baseUrl: string): Promise<ProbeResult[]> {
  const checks = [
    {
      path: '/components',
      status: 200,
      valid: (body: unknown) =>
        isRecord(body) &&
        Array.isArray(body.items) &&
        body.items.length === 0 &&
        body.page === 1 &&
        body.pageSize === 12 &&
        body.total === 0,
    },
    {
      path: '/components/__smoke__',
      status: 404,
      valid: (body: unknown) => isRecord(body) && body.code === 'NOT_FOUND',
    },
    {
      path: '/components/smoke-not-found',
      status: 404,
      valid: (body: unknown) => isRecord(body) && body.code === 'NOT_FOUND',
    },
  ]

  const results: ProbeResult[] = []
  for (const check of checks) {
    try {
      const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(5000) })
      const body: unknown = await response.json()
      results.push({
        path: check.path,
        passed: response.status === check.status && check.valid(body),
      })
    } catch {
      results.push({ path: check.path, passed: false })
    }
  }
  return results
}

if (import.meta.main) {
  const results = await probeCatalog('http://127.0.0.1:4000')
  for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'}: Docker runtime — GET ${result.path}`)
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1
}
