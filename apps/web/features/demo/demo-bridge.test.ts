import { describe, expect, test } from 'bun:test'
import { createKnobsMessage, DEMO_CHANNEL, parseDemoMessage } from './demo-bridge'
import { defaultValues } from './demo-manifest'

describe('demo bridge', () => {
  test('accepts a ready message from a demo', () => {
    expect(parseDemoMessage({ source: DEMO_CHANNEL, version: 1, type: 'ready' })).toEqual({
      source: DEMO_CHANNEL,
      version: 1,
      type: 'ready',
    })
  })

  test('round-trips knob values', () => {
    const message = createKnobsMessage({ duration: 1.5, tone: 'soft' })
    expect(parseDemoMessage(message)).toEqual(message)
  })

  test('rejects messages from other channels, versions or shapes', () => {
    expect(parseDemoMessage({ source: 'other', version: 1, type: 'ready' })).toBeNull()
    expect(parseDemoMessage({ source: DEMO_CHANNEL, version: 2, type: 'ready' })).toBeNull()
    expect(parseDemoMessage({ source: DEMO_CHANNEL, version: 1, type: 'knobs' })).toBeNull()
    expect(
      parseDemoMessage({ source: DEMO_CHANNEL, version: 1, type: 'knobs', values: { x: {} } }),
    ).toBeNull()
    expect(parseDemoMessage('not an object')).toBeNull()
    expect(parseDemoMessage(null)).toBeNull()
  })
})

describe('defaultValues', () => {
  test('takes each knob default', () => {
    expect(
      defaultValues([
        { key: 'a', label: 'A', type: 'range', min: 0, max: 10, step: 1, default: 4 },
        {
          key: 'b',
          label: 'B',
          type: 'enum',
          options: [{ value: 'x', label: 'X' }],
          default: 'x',
        },
      ]),
    ).toEqual({ a: 4, b: 'x' })
  })
})
