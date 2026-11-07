import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import auth from './api/auth/[...auth].mjs'
import deployments from './api/deployments.mjs'
import services from './api/services.mjs'

const html = await readFile(new URL('./public/index.html', import.meta.url))
const port = Number(process.env.PORT || 3400)
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  )
  const path = new URL(req.url, 'http://localhost').pathname
  if (path.startsWith('/api/auth/')) return auth(req, res)
  if (path === '/api/services') return services(req, res)
  if (path === '/api/deployments') return deployments(req, res)
  if (path === '/' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(html)
  }
  res.statusCode = 404
  res.end('Not found')
})
server.listen(port, '127.0.0.1', () => {
  const address = server.address()
  if (address && typeof address === 'object')
    console.log(`Dashboard: http://127.0.0.1:${address.port}`)
})
