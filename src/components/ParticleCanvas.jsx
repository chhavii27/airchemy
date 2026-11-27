import { useEffect, useRef, useState } from 'react'
import { ParticleEngine } from '../engine/ParticleEngine.js'
import { statsStore, formationStore } from '../state/stores.js'

function hasWebGL() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

/**
 * Thin React wrapper around ParticleEngine.
 * - Creates the engine once on mount and disposes it on unmount.
 * - Forwards settings changes to the engine and mirrors the engine's
 *   current formation into formationStore for the UI.
 * - Exposes the engine instance through `engineRef` for gesture control.
 */
export default function ParticleCanvas({ settings, engineRef }) {
  const containerRef = useRef(null)
  const localEngine = useRef(null)
  // Detect WebGL once, during the first render, so we can show a fallback.
  const [supported] = useState(hasWebGL)

  useEffect(() => {
    if (!supported) return undefined
    let engine
    try {
      engine = new ParticleEngine(containerRef.current, {
        settings,
        onStats: (stats) => statsStore.set(stats),
        onFormationChange: (id) => formationStore.set({ id }),
      })
    } catch (err) {
      console.error('WebGL initialisation failed', err)
      return undefined
    }
    localEngine.current = engine
    if (engineRef) engineRef.current = engine

    return () => {
      engine.dispose()
      localEngine.current = null
      if (engineRef) engineRef.current = null
    }
    // The engine is created once; later prop changes are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localEngine.current?.setSettings(settings)
  }, [settings])

  return (
    <div ref={containerRef} className="absolute inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full">
      {!supported && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="glass max-w-md rounded-2xl p-6">
            <p className="font-display text-lg text-white">3D rendering unavailable</p>
            <p className="mt-2 text-sm text-white/60">Your browser could not start WebGL, which Airchemy needs to draw particles. Try the latest Chrome, Edge, Safari or Firefox with hardware acceleration enabled.</p>
          </div>
        </div>
      )}
    </div>
  )
}
