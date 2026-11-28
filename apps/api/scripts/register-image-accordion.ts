import { createDbHandle } from '@marketplace/db'
import {
  ImageAccordionRegistrationConflictError,
  registerImageAccordion,
} from '../src/catalog/register-image-accordion'

const databaseUrl = process.env.IMAGE_ACCORDION_DEV_DATABASE_URL
const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocalPostgres(raw: string) {
  try {
    const url = new URL(raw)
    return ['postgres:', 'postgresql:'].includes(url.protocol) && allowedHosts.has(url.hostname)
  } catch {
    return false
  }
}

if (process.env.NODE_ENV === 'production' || !databaseUrl || !isLocalPostgres(databaseUrl)) {
  console.error('Set IMAGE_ACCORDION_DEV_DATABASE_URL to a local development PostgreSQL database.')
  process.exit(1)
}

const handle = createDbHandle(databaseUrl, { connectTimeout: 5 })
try {
  const result = await registerImageAccordion(handle.db)
  console.log(`Image Accordion ${result.version} registered.`)
} catch (error) {
  console.error(
    error instanceof ImageAccordionRegistrationConflictError
      ? error.message
      : 'Registry setup failed. Check migrations and checked-in release files.',
  )
  process.exitCode = 1
} finally {
  await handle.close()
}
