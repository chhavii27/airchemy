import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../engine/ParticleEngine.js'

const STORAGE_KEY = 'airchemy.settings.v1'

/** Visual + interface settings. Engine settings are forwarded to ParticleEngine. */
export const DEFAULTS = {
  ...DEFAULT_SETTINGS,
  showPreview: true,
  showSkeleton: true,
}

/** Background choices (all dark, so the particles stay the focus). */
export const BACKGROUNDS = [
  { id: 'black', label: 'Near black', hex: '#020308' },
  { id: 'navy', label: 'Midnight navy', hex: '#040a24' },
  { id: 'plum', label: 'Deep plum', hex: '#0d0617' },
  { id: 'void', label: 'Pure black', hex: '#000000' },
]

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // Only keep known keys with the right type, so old or broken data can't break the app.
    const clean = {}
    for (const [key, value] of Object.entries(saved ?? {})) {
      if (key in DEFAULTS && typeof value === typeof DEFAULTS[key]) clean[key] = value
    }
    return { ...DEFAULTS, ...clean }
  } catch {
    return DEFAULTS
  }
}

/**
 * Settings that persist in this browser only (localStorage). If storage is
 * unavailable (private window, blocked cookies) the app simply uses defaults.
 */
export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Storage blocked: settings still work for this visit.
    }
  }, [settings])

  const update = useCallback((partial) => setSettings((s) => ({ ...s, ...partial })), [])
  const reset = useCallback(() => setSettings(DEFAULTS), [])
  return { settings, update, reset }
}
