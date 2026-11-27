import { useCallback, useEffect, useState } from 'react'

/** Fullscreen toggle with the Safari (webkit) fallback. */
export function useFullscreen() {
  const current = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(current()))
  const supported = Boolean(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(current()))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggle = useCallback(async () => {
    const el = document.documentElement
    try {
      if (current()) await (document.exitFullscreen ?? document.webkitExitFullscreen).call(document)
      else await (el.requestFullscreen ?? el.webkitRequestFullscreen).call(el)
    } catch (err) {
      console.warn('Fullscreen not available', err)
    }
  }, [])

  return { isFullscreen, supported, toggle }
}
