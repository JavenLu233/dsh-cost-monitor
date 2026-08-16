/**
 * Shared visibility state for per-turn cost lines: a global default plus
 * per-message overrides, with no priority — the last write wins.
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Shared visibility state. */
export interface VisibilityState {
  /** Default for messages without an override: true = shown, false = hidden. */
  showAll: boolean
  /** Per-message overrides keyed by message id (last action wins). */
  overrides: Record<string, boolean>
}

export type VisibilityStore = SnapshotStore<VisibilityState>

/**
 * Create the visibility store and its two write operations.
 * @returns the shared store, a global setter, and a per-message toggler.
 */
export function createVisibilityStore() {
  const store = createSnapshotStore<VisibilityState>({ showAll: false, overrides: {} })
  const setShowAll = (showAll: boolean): void => {
    store.set({ showAll, overrides: {} })
  }
  const toggleMessage = (messageId: string): void => {
    const current = store.getSnapshot()
    const shown = current.overrides[messageId] ?? current.showAll
    store.set({ ...current, overrides: { ...current.overrides, [messageId]: !shown } })
  }
  return { store, setShowAll, toggleMessage }
}
