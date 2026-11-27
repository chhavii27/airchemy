import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import ParticleCanvas from './components/ParticleCanvas.jsx'
import FormationPicker from './components/FormationPicker.jsx'
import Webcam, { CameraError } from './components/Webcam.jsx'
import GestureIndicator from './components/GestureIndicator.jsx'
import GestureGuide from './components/GestureGuide.jsx'
import FormationTitle from './components/FormationTitle.jsx'
import { useSettings } from './hooks/useSettings.js'
import { GestureController } from './controllers/GestureController.js'
import { useHandTracking } from './hooks/useHandTracking.js'
import { drawHands } from './utils/drawHands.js'

const ERROR_STATUSES = ['denied', 'nocamera', 'unsupported', 'error']

/**
 * Pipeline: camera -> useHandTracking (MediaPipe) -> GestureController -> ParticleEngine.
 * React only renders the interface; the 3D work happens outside it.
 */
export default function App() {
  const engineRef = useRef(null)
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const [errorDismissed, setErrorDismissed] = useState(false)

  const { settings, update: updateSettings, reset: resetSettings } = useSettings()
  // The frame callback reads the latest settings without being recreated.
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  // Only the engine-relevant settings go to ParticleEngine (stable object
  // identity unless one of them actually changes).
  const { count, adaptive, size, speed, glow, background } = settings
  const engineSettings = useMemo(() => ({ count, adaptive, size, speed, glow, background }), [count, adaptive, size, speed, glow, background])

  // Created once; it drives the engine directly from confirmed gestures.
  const [controller] = useState(() => new GestureController({ engineRef }))

  // Runs ~30x per second with fresh landmarks. No React state is touched
  // here except through the controller's change-only store updates.
  const onFrame = useCallback(
    (result, now) => {
      if (result) controller.update(result, now)
      else controller.reset()
      drawHands(overlayRef.current, result, { showSkeleton: settingsRef.current.showSkeleton })
    },
    [controller],
  )

  const tracking = useHandTracking({ videoRef, onFrame })
  const startCamera = () => {
    setErrorDismissed(false)
    tracking.start()
  }
  const cameraLive = tracking.status === 'running'

  const resetFormation = () => {
    controller.reset()
    engineRef.current?.reset()
  }

  return (
    <main className="relative h-full w-full overflow-hidden transition-colors duration-500" style={{ background: settings.background }}>
      <ParticleCanvas settings={engineSettings} engineRef={engineRef} />
      {/* Soft vignette keeps the eye on the centre. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />

      <Header
        cameraStatus={tracking.status}
        onStartCamera={startCamera}
        onStopCamera={tracking.stop}
        settings={settings}
        onSettingsChange={updateSettings}
        onSettingsReset={resetSettings}
        onReset={resetFormation}
      />

      <aside className="pointer-events-none absolute top-24 left-4 z-10 hidden flex-col gap-3 sm:left-6 md:flex [&>*]:pointer-events-auto">
        {cameraLive && <GestureIndicator />}
        <GestureGuide />
      </aside>
      {cameraLive && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center md:hidden">
          <GestureIndicator />
        </div>
      )}

      <Webcam videoRef={videoRef} canvasRef={overlayRef} status={tracking.status} visible={settings.showPreview} />
      {ERROR_STATUSES.includes(tracking.status) && !errorDismissed && (
        <CameraError message={tracking.error} onRetry={startCamera} onDismiss={() => setErrorDismissed(true)} />
      )}

      {!cameraLive && tracking.status !== 'loading' && (
        <p className="pointer-events-none absolute inset-x-0 bottom-32 z-10 text-center text-xs text-white/40">
          Press <span className="text-white/70">Start camera</span> to shape particles with your hands, or pick a shape below.
        </p>
      )}

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 sm:p-6 [&>*]:pointer-events-auto">
        <FormationTitle />
        <div className="max-w-full overflow-x-auto">
          <FormationPicker engineRef={engineRef} />
        </div>
      </footer>
    </main>
  )
}
