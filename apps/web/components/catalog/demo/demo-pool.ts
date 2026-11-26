/**
 * Caps how many live demo iframes run at once, so a catalog page with many
 * cards never starts dozens of animation loops. Plain module state: it is only
 * read and written from client effects.
 */

export const MAX_LIVE_DEMOS = 4

const held = new Set<symbol>()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Takes a slot for `id`. Returns false when every slot is already taken. */
export function acquireDemoSlot(id: symbol): boolean {
  if (held.has(id)) return true
  if (held.size >= MAX_LIVE_DEMOS) return false
  held.add(id)
  return true
}

/** Frees the slot for `id` and wakes any card that is waiting for one. */
export function releaseDemoSlot(id: symbol): void {
  if (held.delete(id)) notify()
}

/** Calls `listener` whenever a slot is freed. Returns the unsubscribe function. */
export function subscribeDemoSlots(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test helper: clears all slots and listeners. */
export function resetDemoPool(): void {
  held.clear()
  listeners.clear()
}
