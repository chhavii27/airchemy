import { useSyncExternalStore } from 'react'

/**
 * Tiny observable store.
 *
 * High-frequency data (FPS, gesture state, hand position) changes many times
 * per second. Putting it in App-level React state would re-render the whole
 * tree. Instead it lives here, and only the small components that display it
 * subscribe via `useStore`.
 */
export function createStore(initialState) {
  let state = initialState
  const listeners = new Set()
  return {
    get: () => state,
    set(partial) {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()))
}
