/**
 * Gesture recognition from MediaPipe's 21 hand landmarks.
 *
 * Landmark indices (same for left and right hands):
 *   0 wrist
 *   1-4   thumb  (CMC, MCP, IP, TIP)
 *   5-8   index  (MCP, PIP, DIP, TIP)
 *   9-12  middle
 *   13-16 ring
 *   17-20 pinky
 *
 * All functions are pure: landmarks in -> numbers/labels out. Everything is
 * measured relative to the hand's own size ("palm size" = wrist to middle
 * knuckle), so it works whether your hand is close or far from the camera,
 * and uses angles/ratios so it works for left and right hands alike.
 */
import { clamp } from './mathHelpers.js'

export const GESTURES = {
  point: { label: 'Index finger', action: 'No action' },
  two: { label: 'Two fingers', action: 'Mystic Wings' },
  three: { label: 'Three fingers', action: 'Divine Blossom' },
  open: { label: 'Open palm', action: 'Golden Orbit' },
  fist: { label: 'Closed fist', action: 'Electric Plasma' },
  pinch: { label: 'Pinch', action: 'Resize' },
  heart: { label: 'Two-hand heart', action: 'Eternal Love' },
  none: { label: 'Unrecognised', action: '—' },
}

const FINGER_JOINTS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}

// Tunable thresholds (exported so tests and future tuning can see them).
export const THRESHOLDS = {
  extended: 0.5, // finger score above this counts as "raised"
  pinchClose: 0.32, // thumb-index tip distance (in palm sizes) that counts as pinching
}

const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z]
const len = (v) => Math.hypot(v[0], v[1], v[2])
const dist = (a, b) => len(sub(a, b))
function cosBetween(u, v) {
  const d = len(u) * len(v)
  return d === 0 ? 1 : (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / d
}

/**
 * MediaPipe x/y are 0..1 fractions of image width/height. On a 4:3 camera a
 * step in x is longer than the same step in y, so scale x (and z, which
 * MediaPipe expresses on the x scale) by the aspect ratio to get true shapes.
 */
function normalize(landmarks, aspect) {
  return landmarks.map((p) => ({ x: p.x * aspect, y: p.y, z: (p.z ?? 0) * aspect }))
}

/**
 * How "raised" a finger is, from 0 (curled) to 1 (straight).
 * Combines two signals:
 *  - straightness: are the finger's bones lined up? (cosine of joint angles)
 *  - reach: is the fingertip further from the wrist than the middle joint?
 *    (a curled finger folds its tip back toward the palm)
 */
export function fingerScore(lm, [mcp, pip, dip, tip]) {
  const straight =
    (cosBetween(sub(lm[pip], lm[mcp]), sub(lm[tip], lm[pip])) +
      cosBetween(sub(lm[dip], lm[pip]), sub(lm[tip], lm[dip]))) /
    2
  const reach = dist(lm[0], lm[tip]) / Math.max(dist(lm[0], lm[pip]), 1e-6)
  const straightScore = clamp((straight - 0.3) / 0.6, 0, 1)
  const reachScore = clamp((reach - 0.95) / 0.3, 0, 1)
  return Math.sqrt(straightScore * reachScore)
}

/** Thumb is "out" when its tip is well away from the index knuckle. */
export function thumbScore(lm, palmSize) {
  const spread = dist(lm[4], lm[5]) / palmSize
  return clamp((spread - 0.5) / 0.35, 0, 1)
}

/** Centre of the palm (average of wrist + four knuckles), in raw 0..1 image coords. */
export function palmCenter(landmarks) {
  let x = 0
  let y = 0
  for (const i of [0, 5, 9, 13, 17]) {
    x += landmarks[i].x
    y += landmarks[i].y
  }
  return { x: x / 5, y: y / 5 }
}

/**
 * Hand roll in radians: 0 when fingers point straight up, positive when
 * the hand tilts so the fingers lean toward the image's right side.
 */
export function handRoll(landmarks, aspect = 4 / 3) {
  const dx = (landmarks[9].x - landmarks[0].x) * aspect
  const dy = landmarks[9].y - landmarks[0].y
  return Math.atan2(dx, -dy)
}

/**
 * Classify one hand.
 * @param {{x:number,y:number,z?:number}[]} landmarks 21 normalised landmarks
 * @returns {{ gesture: string, confidence: number, fingers: object,
 *             pinchDistance: number, palmSize: number }}
 */
export function recognizeHand(landmarks, { aspect = 4 / 3 } = {}) {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: 'none', confidence: 0, fingers: null, pinchDistance: 0, palmSize: 0 }
  }
  const lm = normalize(landmarks, aspect)
  const palmSize = Math.max(dist(lm[0], lm[9]), 1e-6)

  const scores = {
    thumb: thumbScore(lm, palmSize),
    index: fingerScore(lm, FINGER_JOINTS.index),
    middle: fingerScore(lm, FINGER_JOINTS.middle),
    ring: fingerScore(lm, FINGER_JOINTS.ring),
    pinky: fingerScore(lm, FINGER_JOINTS.pinky),
  }
  const up = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v > THRESHOLDS.extended]))
  const pinchDistance = dist(lm[4], lm[8]) / palmSize
  // Index tip must stick out past its knuckle, otherwise "thumb touching a
  // curled index finger" inside a fist would look like a pinch.
  const indexOut = dist(lm[0], lm[8]) > dist(lm[0], lm[5]) * 1.05

  let gesture = 'none'
  let relevant // which fingers' certainty decides the confidence
  if (pinchDistance < THRESHOLDS.pinchClose && indexOut) {
    gesture = 'pinch'
    relevant = []
  } else if (!up.index && !up.middle && !up.ring && !up.pinky) {
    gesture = 'fist'
    relevant = ['index', 'middle', 'ring', 'pinky']
  } else if (up.index && !up.middle && !up.ring && !up.pinky) {
    // Index + thumb out (an "L") is the open pinch pose; index alone is pointing.
    gesture = up.thumb ? 'pinch' : 'point'
    relevant = ['index', 'middle', 'ring', 'pinky', 'thumb']
  } else if (up.index && up.middle && !up.ring && !up.pinky) {
    gesture = 'two'
    relevant = ['index', 'middle', 'ring', 'pinky']
  } else if (up.index && up.middle && up.ring && !up.pinky) {
    gesture = 'three'
    relevant = ['index', 'middle', 'ring', 'pinky']
  } else if (up.index && up.middle && up.ring && up.pinky) {
    gesture = 'open'
    relevant = ['index', 'middle', 'ring', 'pinky']
  }

  // Confidence = how clear-cut the least certain finger is. A half-bent
  // finger (score ~0.5) drags confidence toward 0.
  let confidence = 0
  if (gesture === 'pinch' && relevant.length === 0) {
    confidence = clamp(1 - pinchDistance / THRESHOLDS.pinchClose, 0, 1) * 0.5 + 0.5
  } else if (relevant) {
    confidence = Math.min(...relevant.map((f) => Math.abs(scores[f] - 0.5) * 2))
  }

  return { gesture, confidence, fingers: scores, pinchDistance, palmSize }
}

/**
 * Two-hand gestures.
 *  - Heart: both index fingertips touch at the top and both thumb tips touch
 *    at the bottom, with a gap between them (the classic hand heart).
 *  - Spread: the distance between the two palms, used to expand/compress.
 *
 * @returns {{ gesture: 'heart'|'none', confidence: number,
 *             spread: number, center: {x:number, y:number} }}
 *          spread is the palm-to-palm distance in aspect-corrected image units.
 */
export function recognizeTwoHands(handA, handB, { aspect = 4 / 3 } = {}) {
  const a = normalize(handA, aspect)
  const b = normalize(handB, aspect)
  const palm = (dist(a[0], a[9]) + dist(b[0], b[9])) / 2 || 1e-6

  const indexGap = dist(a[8], b[8]) / palm
  const thumbGap = dist(a[4], b[4]) / palm
  const indexY = (a[8].y + b[8].y) / 2
  const thumbY = (a[4].y + b[4].y) / 2
  // Image y grows downward, so "index above thumbs" means a smaller y.
  const opening = (thumbY - indexY) / palm
  const heart = indexGap < 0.55 && thumbGap < 0.55 && opening > 0.35

  const ca = palmCenter(handA)
  const cb = palmCenter(handB)
  return {
    gesture: heart ? 'heart' : 'none',
    confidence: heart ? clamp(1 - Math.max(indexGap, thumbGap) / 0.55, 0, 1) * 0.6 + 0.4 : 0,
    spread: Math.hypot((ca.x - cb.x) * aspect, ca.y - cb.y),
    center: { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 },
  }
}
