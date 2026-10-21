import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output để chạy trong Docker image tối giản
  output: 'standalone',
  reactStrictMode: true,
}

export default nextConfig
