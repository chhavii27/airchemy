import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const BASE = import.meta.env.BASE_URL // '/' in dev and on Vercel
const WASM_PATH = `${BASE}mediapipe/wasm` // no trailing slash: MediaPipe appends "/vision_wasm_internal.js"
const MODEL_PATH = `${BASE}mediapipe/models/hand_landmarker.task`

/**
 * The landmarker (WASM runtime + ~8 MB model) is expensive to create, so it
 * is created once on first use and reused when the camera is restarted.
 * Both files are served from our own origin; video frames never leave the
 * browser.
 */
let landmarkerPromise = null
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })
      try {
        return await HandLandmarker.createFromOptions(fileset, options('GPU'))
      } catch (gpuError) {
        console.warn('GPU delegate unavailable, falling back to CPU', gpuError)
        return HandLandmarker.createFromOptions(fileset, options('CPU'))
      }
    })()
    // Allow a retry if loading failed (e.g. offline).
    landmarkerPromise.catch(() => {
      landmarkerPromise = null
    })
  }
  return landmarkerPromise
}

function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'denied', message: 'Camera permission was denied. Allow camera access in your browser’s address bar, then try again.' }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { status: 'nocamera', message: 'No camera was found. Connect a webcam, or use the formation buttons instead.' }
    case 'NotReadableError':
    case 'AbortError':
      return { status: 'error', message: 'The camera is busy in another app (Zoom, FaceTime…). Close it and try again.' }
    default:
      return { status: 'error', message: `Hand tracking could not start: ${err?.message ?? 'unknown error'}` }
  }
}

/**
 * Webcam + MediaPipe hand tracking.
 *
 * @param {object}   opts
 * @param {React.RefObject<HTMLVideoElement>} opts.videoRef
 * @param {(result: import('@mediapipe/tasks-vision').HandLandmarkerResult|null, now: number) => void} opts.onFrame
 *        Called ~detectFps times per second with landmarks, and with null when tracking stops.
 * @param {number} [opts.detectFps=30] Detection rate, independent of the render frame rate.
 * @returns {{ status: 'idle'|'loading'|'running'|'denied'|'nocamera'|'unsupported'|'error',
 *             error: string|null, start: () => Promise<void>, stop: () => void }}
 */
export function useHandTracking({ videoRef, onFrame, detectFps = 30 }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const onFrameRef = useRef(onFrame)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const sessionRef = useRef(0) // increments on every start/stop, cancels stale async work

  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    streamRef.current?.getTracks().forEach((track) => track.stop()) // turns the camera light off
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    onFrameRef.current?.(null, performance.now())
  }, [videoRef])

  const stop = useCallback(() => {
    sessionRef.current++
    release()
    setStatus('idle')
    setError(null)
  }, [release])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setError('This browser cannot access a camera here. Use a recent Chrome, Edge, Safari or Firefox over https or localhost.')
      return
    }
    const session = ++sessionRef.current
    setStatus('loading')
    setError(null)

    let stream
    try {
      // Start both at once: the permission prompt and model download overlap.
      const [mediaStream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        }),
        getLandmarker(),
      ])
      stream = mediaStream
      if (session !== sessionRef.current) {
        // The user pressed stop while we were loading.
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      // If the camera is unplugged or revoked, stop cleanly.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (session !== sessionRef.current) return
        sessionRef.current++
        release()
        setStatus('error')
        setError('The camera was disconnected.')
      })

      setStatus('running')

      let lastDetect = 0
      let lastVideoTime = -1
      const interval = 1000 / detectFps
      const loop = () => {
        if (session !== sessionRef.current) return
        rafRef.current = requestAnimationFrame(loop)
        const now = performance.now()
        // Throttle: detection is the expensive part, and 30 Hz is plenty for hands.
        if (now - lastDetect < interval || video.readyState < 2 || video.currentTime === lastVideoTime) return
        lastDetect = now
        lastVideoTime = video.currentTime
        const result = landmarker.detectForVideo(video, now)
        onFrameRef.current?.(result, now)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop())
      if (session !== sessionRef.current) return
      console.error(err)
      const { status: nextStatus, message } = describeCameraError(err)
      streamRef.current = null
      setStatus(nextStatus)
      setError(message)
    }
  }, [detectFps, release, videoRef])

  // Stop the camera when the component using this hook unmounts.
  useEffect(
    () => () => {
      sessionRef.current++
      release()
    },
    [release],
  )

  return { status, error, start, stop }
}
