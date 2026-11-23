import type { NextConfig } from 'next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

const nextConfig = (phase: string): NextConfig => ({
  // Vercel's Next adapter uses the default output; Docker opts into standalone.
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  experimental: { agentUpgrade: 'security' },
  ...(phase === PHASE_PRODUCTION_BUILD && {
    typescript: { tsconfigPath: 'tsconfig.typecheck.json' },
  }),
})

export default nextConfig
