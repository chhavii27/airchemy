import { CameraOff, LoaderCircle } from 'lucide-react'

/**
 * Small mirrored webcam preview with a hand-skeleton overlay.
 * The <video> element must always stay mounted (the tracking hook writes the
 * camera stream into it), so the card is hidden with CSS instead of removed.
 */
export default function Webcam({ videoRef, canvasRef, status, visible }) {
  const active = status === 'running' || status === 'loading'
  return (
    <div
      className={`glass absolute right-4 bottom-24 z-10 w-40 overflow-hidden rounded-2xl transition-all duration-500 sm:right-6 sm:bottom-6 sm:w-60 ${
        active && visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
      aria-hidden={!(active && visible)}
    >
      <div className="relative aspect-[4/3] bg-black">
        {/* Mirrored like a selfie camera; the overlay is mirrored identically. */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-white/70">
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading hand model…
            </span>
          </div>
        )}
        {status === 'running' && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> LIVE
          </span>
        )}
      </div>
      <p className="px-3 py-1.5 text-[10px] text-white/45">Processed on this device · never uploaded</p>
    </div>
  )
}

/** Shown when the camera cannot be used, with a way to retry. */
export function CameraError({ message, onRetry, onDismiss }) {
  return (
    <div role="alert" className="glass absolute right-4 bottom-24 z-20 max-w-xs rounded-2xl p-4 sm:right-6 sm:bottom-6">
      <div className="flex items-start gap-3">
        <CameraOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        <div>
          <p className="text-sm font-medium text-white">Camera unavailable</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">{message}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onRetry} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20">
              Try again
            </button>
            <button type="button" onClick={onDismiss} className="rounded-full px-3 py-1 text-xs text-white/55 hover:text-white">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
