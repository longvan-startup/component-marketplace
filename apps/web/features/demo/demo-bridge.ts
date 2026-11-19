/**
 * Message protocol between the Luva page and a demo iframe. The iframe is
 * sandboxed without `allow-same-origin`, so the page checks the sender window
 * (`event.source`) instead of the origin, and only accepts this versioned shape.
 */
import type { DemoValues } from './demo-manifest'

export const DEMO_CHANNEL = 'luva-demo'
export const DEMO_PROTOCOL_VERSION = 1

export type DemoMessage =
  | { source: typeof DEMO_CHANNEL; version: typeof DEMO_PROTOCOL_VERSION; type: 'ready' }
  | {
      source: typeof DEMO_CHANNEL
      version: typeof DEMO_PROTOCOL_VERSION
      type: 'knobs'
      values: DemoValues
    }

export function createKnobsMessage(values: DemoValues): DemoMessage {
  return { source: DEMO_CHANNEL, version: DEMO_PROTOCOL_VERSION, type: 'knobs', values }
}

function isDemoValues(value: unknown): value is DemoValues {
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every((v) => typeof v === 'number' || typeof v === 'string')
}

/** Returns the message when `data` matches the protocol, otherwise null. */
export function parseDemoMessage(data: unknown): DemoMessage | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.source !== DEMO_CHANNEL || record.version !== DEMO_PROTOCOL_VERSION) return null
  if (record.type === 'ready') {
    return { source: DEMO_CHANNEL, version: DEMO_PROTOCOL_VERSION, type: 'ready' }
  }
  if (record.type === 'knobs' && isDemoValues(record.values)) {
    return {
      source: DEMO_CHANNEL,
      version: DEMO_PROTOCOL_VERSION,
      type: 'knobs',
      values: record.values,
    }
  }
  return null
}
