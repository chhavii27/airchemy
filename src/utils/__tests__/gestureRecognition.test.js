import { describe, it, expect } from 'vitest'
import { recognizeHand, recognizeTwoHands, palmCenter, handRoll } from '../gestureRecognition.js'

const ASPECT = 4 / 3

/**
 * Build a synthetic 21-landmark hand in "true" (aspect-corrected) units,
 * wrist at origin, fingers pointing up (negative y, like image coords).
 * Then convert to MediaPipe-style normalised coordinates.
 */
function makeHand({ thumb = false, index = false, middle = false, ring = false, pinky = false, pinch = false } = {}) {
  const pts = new Array(21)
  pts[0] = [0, 0, 0]
  // Thumb chain: out to the side, or tucked across the palm.
  pts[1] = [-0.05, -0.04, 0]
  pts[2] = [-0.09, -0.08, 0]
  pts[3] = thumb ? [-0.14, -0.1, 0] : [-0.07, -0.11, -0.01]
  pts[4] = thumb ? [-0.2, -0.1, 0] : [0, -0.12, -0.02]

  const knuckleX = { index: -0.06, middle: -0.02, ring: 0.02, pinky: 0.06 }
  const up = { index, middle, ring, pinky }
  const base = { index: 5, middle: 9, ring: 13, pinky: 17 }
  for (const f of Object.keys(base)) {
    const b = base[f]
    const mcp = [knuckleX[f], -0.18, 0]
    pts[b] = mcp
    if (up[f]) {
      pts[b + 1] = [mcp[0], mcp[1] - 0.06, 0]
      pts[b + 2] = [mcp[0], mcp[1] - 0.1, 0]
      pts[b + 3] = [mcp[0], mcp[1] - 0.13, 0]
    } else {
      // Folded: middle joint rises a little, then the tip curls back to the palm.
      pts[b + 1] = [mcp[0], mcp[1] - 0.045, -0.02]
      pts[b + 2] = [mcp[0], mcp[1] - 0.01, -0.05]
      pts[b + 3] = [mcp[0], mcp[1] + 0.03, -0.03]
    }
  }
  if (pinch) {
    // Index bends forward and the thumb tip meets it.
    pts[6] = [-0.07, -0.24, -0.01]
    pts[7] = [-0.09, -0.27, -0.03]
    pts[8] = [-0.11, -0.28, -0.05]
    pts[3] = [-0.13, -0.18, -0.02]
    pts[4] = [-0.115, -0.27, -0.05]
  }
  return pts
}

/** Rotate a hand in the image plane, optionally mirror it, place it in frame. */
function toLandmarks(pts, { angle = 0, mirror = false } = {}) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return pts.map(([x, y, z]) => {
    let rx = x * c - y * s
    const ry = x * s + y * c
    if (mirror) rx = -rx
    return { x: 0.5 + rx / ASPECT, y: 0.7 + ry, z: z / ASPECT }
  })
}

const cases = [
  ['fist', {}],
  ['point', { index: true }],
  ['two', { index: true, middle: true }],
  ['three', { index: true, middle: true, ring: true }],
  ['open', { thumb: true, index: true, middle: true, ring: true, pinky: true }],
  ['pinch', { thumb: true, index: true }], // "L" shape = open pinch
  ['pinch', { pinch: true }], // fingertips touching
]

describe('recognizeHand', () => {
  it.each(cases)('recognises %s', (expected, fingers) => {
    const result = recognizeHand(toLandmarks(makeHand(fingers)))
    expect(result.gesture).toBe(expected)
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it.each(cases)('recognises %s on the other hand (mirrored)', (expected, fingers) => {
    expect(recognizeHand(toLandmarks(makeHand(fingers), { mirror: true })).gesture).toBe(expected)
  })

  it.each(cases)('recognises %s when the hand is tilted 35°', (expected, fingers) => {
    expect(recognizeHand(toLandmarks(makeHand(fingers), { angle: 0.6 })).gesture).toBe(expected)
  })

  it('treats four fingers without the thumb as an open palm', () => {
    const lm = toLandmarks(makeHand({ index: true, middle: true, ring: true, pinky: true }))
    expect(recognizeHand(lm).gesture).toBe('open')
  })

  it('returns none for unsupported poses (e.g. pinky only)', () => {
    expect(recognizeHand(toLandmarks(makeHand({ pinky: true }))).gesture).toBe('none')
  })

  it('handles missing or partial landmarks safely', () => {
    expect(recognizeHand(undefined).gesture).toBe('none')
    expect(recognizeHand([{ x: 0, y: 0, z: 0 }]).gesture).toBe('none')
  })

  it('is scale invariant (hand near vs far from camera)', () => {
    const fingers = { index: true, middle: true }
    const small = makeHand(fingers).map(([x, y, z]) => [x * 0.4, y * 0.4, z * 0.4])
    expect(recognizeHand(toLandmarks(small)).gesture).toBe('two')
  })
})

describe('hand pose helpers', () => {
  it('palmCenter averages wrist and knuckles', () => {
    const c = palmCenter(toLandmarks(makeHand()))
    expect(c.x).toBeCloseTo(0.5, 2)
    expect(c.y).toBeLessThan(0.7)
  })

  it('handRoll is near 0 upright and follows tilt', () => {
    const upright = handRoll(toLandmarks(makeHand()))
    expect(Math.abs(upright)).toBeLessThan(0.15)
    // Rotating the image by +0.5 rad leans the fingers toward image-right.
    expect(handRoll(toLandmarks(makeHand(), { angle: 0.5 })) - upright).toBeCloseTo(0.5, 2)
  })
})

describe('recognizeTwoHands', () => {
  /** Place a hand by shifting its landmarks. */
  const shift = (lm, dx, dy = 0) => lm.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))

  it('builds an explicit heart pose and recognises it', () => {
    const base = toLandmarks(makeHand({ thumb: true, index: true }))
    const left = base.map((p) => ({ ...p }))
    const right = base.map((p) => ({ ...p, x: 1 - p.x })) // mirror image = other hand
    // Index tips meet at the top centre, thumb tips meet lower down.
    left[8] = { x: 0.49, y: 0.4, z: 0 }
    right[8] = { x: 0.51, y: 0.4, z: 0 }
    left[4] = { x: 0.49, y: 0.6, z: 0 }
    right[4] = { x: 0.51, y: 0.6, z: 0 }
    expect(recognizeTwoHands(left, right).gesture).toBe('heart')
  })

  it('is not a heart when the hands are apart, and spread grows with distance', () => {
    const hand = toLandmarks(makeHand({ thumb: true, index: true, middle: true, ring: true, pinky: true }))
    const near = recognizeTwoHands(shift(hand, -0.1), shift(hand, 0.1))
    const far = recognizeTwoHands(shift(hand, -0.3), shift(hand, 0.3))
    expect(near.gesture).toBe('none')
    expect(far.gesture).toBe('none')
    expect(far.spread).toBeGreaterThan(near.spread)
    expect(far.center.x).toBeCloseTo(0.5 + (palmCenter(hand).x - 0.5), 5)
  })
})
