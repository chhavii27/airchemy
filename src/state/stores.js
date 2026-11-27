import { createStore } from '../utils/store.js'

/** Render statistics published by the ParticleEngine twice per second. */
export const statsStore = createStore({ fps: 0, particles: 0 })

/** Latest hand-tracking state, published by GestureController on change.
 *  mode: 'spread' while two hands are resizing, otherwise null. */
export const gestureStore = createStore({ hands: 0, gesture: null, raw: null, mode: null })

/** The formation currently shown. The engine is the source of truth and
 *  publishes here, so buttons and gestures always agree. */
export const formationStore = createStore({ id: 'sphere' })
