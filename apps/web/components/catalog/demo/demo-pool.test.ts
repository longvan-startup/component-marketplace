import { beforeEach, describe, expect, test } from 'bun:test'
import {
  acquireDemoSlot,
  MAX_LIVE_DEMOS,
  releaseDemoSlot,
  resetDemoPool,
  subscribeDemoSlots,
} from './demo-pool'

beforeEach(() => resetDemoPool())

describe('demo pool', () => {
  test('allows at most MAX_LIVE_DEMOS live demos', () => {
    const ids = Array.from({ length: MAX_LIVE_DEMOS + 1 }, () => Symbol('demo'))
    const results = ids.map((id) => acquireDemoSlot(id))
    expect(results.slice(0, MAX_LIVE_DEMOS).every(Boolean)).toBe(true)
    expect(results[MAX_LIVE_DEMOS]).toBe(false)
  })

  test('re-acquiring a held slot keeps it without using another one', () => {
    const id = Symbol('demo')
    expect(acquireDemoSlot(id)).toBe(true)
    expect(acquireDemoSlot(id)).toBe(true)
  })

  test('releasing a slot frees it and notifies waiting listeners', () => {
    const ids = Array.from({ length: MAX_LIVE_DEMOS }, () => Symbol('demo'))
    for (const id of ids) acquireDemoSlot(id)

    const waiting = Symbol('waiting')
    let notified = 0
    const unsubscribe = subscribeDemoSlots(() => {
      notified += 1
    })
    expect(acquireDemoSlot(waiting)).toBe(false)

    releaseDemoSlot(ids[0] as symbol)
    expect(notified).toBe(1)
    expect(acquireDemoSlot(waiting)).toBe(true)
    unsubscribe()
  })

  test('releasing an unheld slot does not notify', () => {
    let notified = 0
    const unsubscribe = subscribeDemoSlots(() => {
      notified += 1
    })
    releaseDemoSlot(Symbol('never-held'))
    expect(notified).toBe(0)
    unsubscribe()
  })
})
