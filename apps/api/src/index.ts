/**
 * API entrypoint — skeleton tối thiểu để boot.
 * KHÔNG chứa business logic (auth, payment, marketplace... tích hợp sau).
 */

import { getAppInfo } from '@marketplace/shared'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(express.json())

// Health check — dùng bởi Docker healthcheck & CI smoke test
app.get('/health', (_req, res) => {
  const info = getAppInfo()
  res.status(200).json({
    status: 'ok',
    service: 'api',
    app: info.name,
    version: info.version,
    uptime: process.uptime(),
  })
})

// Root — xác nhận skeleton đã boot
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Component Marketplace API — skeleton OK' })
})

const server = app.listen(port, () => {
  console.log(`[api] listening on http://0.0.0.0:${port}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
