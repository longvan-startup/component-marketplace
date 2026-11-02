import type { NextConfig } from 'next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

const nextConfig = (phase: string): NextConfig => ({
  // Standalone output để chạy trong Docker image tối giản
  output: 'standalone',
  reactStrictMode: true,
  ...(phase === PHASE_PRODUCTION_BUILD && {
    typescript: { tsconfigPath: 'tsconfig.typecheck.json' },
  }),
})

export default nextConfig
