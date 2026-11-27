import { Camera, CameraOff, LoaderCircle, Maximize, Minimize, RotateCcw } from 'lucide-react'
import PerformanceMonitor from './PerformanceMonitor.jsx'
import ControlPanel from './ControlPanel.jsx'
import { useFullscreen } from '../hooks/useFullscreen.js'

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <defs>
        <linearGradient id="ac-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5ef2ff" />
          <stop offset="0.5" stopColor="#a66bff" />
          <stop offset="1" stopColor="#ff5ec8" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="none" stroke="url(#ac-logo)" strokeWidth="1.5" opacity="0.9" />
      <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="url(#ac-logo)" strokeWidth="1" opacity="0.55" transform="rotate(-24 16 16)" />
      <circle cx="16" cy="16" r="3.2" fill="url(#ac-logo)" />
    </svg>
  )
}

function CameraButton({ status, onStart, onStop }) {
  const running = status === 'running'
  const loading = status === 'loading'
  return (
    <button
      type="button"
      onClick={running || loading ? onStop : onStart}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-2 focus-visible:outline-cyan-glow ${
        running
          ? 'glass text-white hover:bg-white/10'
          : 'bg-gradient-to-r from-cyan-glow/90 via-violet-glow/90 to-pink-glow/90 text-void shadow-[0_0_24px_rgba(166,107,255,0.45)] hover:shadow-[0_0_32px_rgba(94,242,255,0.55)]'
      }`}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : running ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
      {loading ? 'Starting…' : running ? 'Stop camera' : 'Start camera'}
    </button>
  )
}

const iconButton =
  'glass grid h-9 w-9 place-items-center rounded-full text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/40'

export default function Header({ cameraStatus, onStartCamera, onStopCamera, settings, onSettingsChange, onSettingsReset, onReset }) {
  const fullscreen = useFullscreen()
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
      <div className="pointer-events-auto flex items-center gap-3">
        <Logo />
        <div className="leading-tight">
          <h1 className="font-display text-lg font-medium tracking-tight text-white">Airchemy</h1>
          <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">Reality at your fingertips</p>
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        {cameraStatus === 'running' && (
          // Always visible (dot-only on phones), even when the preview is hidden.
          <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1.5 text-[11px] text-rose-200" title="Camera active">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            <span className="hidden sm:inline">Camera active</span>
          </span>
        )}
        <span className="hidden lg:block">
          <PerformanceMonitor />
        </span>
        <button type="button" onClick={onReset} aria-label="Reset formation" title="Reset formation" className={iconButton}>
          <RotateCcw className="h-4 w-4" />
        </button>
        {fullscreen.supported && (
          <button type="button" onClick={fullscreen.toggle} aria-label={fullscreen.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={fullscreen.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} className={iconButton}>
            {fullscreen.isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}
        <ControlPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} />
        <CameraButton status={cameraStatus} onStart={onStartCamera} onStop={onStopCamera} />
      </div>
    </header>
  )
}
