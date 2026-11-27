import { HandLandmarker } from '@mediapipe/tasks-vision'

/**
 * Draws hand skeletons onto the overlay canvas that sits on top of the
 * webcam preview. The canvas is mirrored with CSS exactly like the video,
 * so raw (unmirrored) landmark coordinates line up with the picture.
 */
export function drawHands(canvas, result, { showSkeleton = true } = {}) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio, 2)
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  if (!showSkeleton || !result?.landmarks?.length) return

  ctx.lineCap = 'round'
  result.landmarks.forEach((hand, handIndex) => {
    // Pink skeleton: hot pink for the first hand, soft pink for the second.
    const color = handIndex === 0 ? '255, 77, 166' : '255, 160, 210'
    ctx.strokeStyle = `rgba(${color}, 0.85)`
    ctx.lineWidth = 2
    ctx.shadowColor = `rgba(${color}, 0.9)`
    ctx.shadowBlur = 6
    ctx.beginPath()
    for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
      ctx.moveTo(hand[start].x * w, hand[start].y * h)
      ctx.lineTo(hand[end].x * w, hand[end].y * h)
    }
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffe0f0'
    for (const [i, p] of hand.entries()) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, [4, 8, 12, 16, 20].includes(i) ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
