import { recognizeHand, recognizeTwoHands, palmCenter, handRoll } from '../utils/gestureRecognition.js'
import { GestureStabilizer } from '../utils/gestureStabilizer.js'
import { clamp } from '../utils/mathHelpers.js'
import { gestureStore } from '../state/stores.js'

/** Which formation each stable gesture summons. Gestures not listed here
 *  (pinch, point) never switch shapes. */
export const GESTURE_TO_FORMATION = {
  fist: 'sphere',
  two: 'butterfly',
  three: 'lotus',
  open: 'saturn',
  heart: 'heart',
}

const MAX_ROLL = Math.PI / 3 // ignore extreme wrist angles
const ROLL_DEADZONE = 0.12 // radians; a relaxed hand is never perfectly upright

/**
 * The glue between hand tracking and the particle engine:
 *   landmarks -> recognizeHand / recognizeTwoHands -> GestureStabilizer -> engine + UI
 * Kept out of React so it can run 30 times a second without re-rendering.
 *
 * Conflict rules (so gestures never fight each other):
 *  - Pinch and two-hand spread only change size, never the formation.
 *  - With two hands visible, only the heart can switch formations; otherwise
 *    the hands control size (spread) and position (midpoint).
 *  - A burst (fist -> quickly open) wins over the plain open-palm switch.
 */
export class GestureController {
  /** @param {{ engineRef: {current: import('../engine/ParticleEngine.js').ParticleEngine|null} }} opts */
  constructor({ engineRef }) {
    this.engineRef = engineRef
    this.stabilizer = new GestureStabilizer()
    this.scale = 1
    this.lastPinchDistance = 0
  }

  /** Pick the hand closest to the camera (largest on screen) as the controller. */
  pickPrimary(result) {
    let best = 0
    let bestSize = -1
    result.landmarks.forEach((lm, i) => {
      const size = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y)
      if (size > bestSize) {
        bestSize = size
        best = i
      }
    })
    return best
  }

  update(result, now) {
    const engine = this.engineRef.current
    const hands = result?.landmarks?.length ?? 0

    if (hands === 0) {
      const out = this.stabilizer.update(null, 0, now)
      this.applyTransitions(out, engine)
      if (out.gesture === null) engine?.setHandTarget(null)
      this.publish({ hands: 0, gesture: out.gesture, raw: null, mode: null })
      return
    }

    const landmarks = result.landmarks[this.pickPrimary(result)]
    let raw
    let confidence
    let position
    let mode = null

    if (hands >= 2) {
      const two = recognizeTwoHands(result.landmarks[0], result.landmarks[1])
      // Feed only 'heart' (or 'none', which never switches) to the stabilizer.
      raw = two.gesture
      confidence = two.confidence
      position = two.center
      if (two.gesture !== 'heart') {
        // Hands 0.15 apart -> compressed, 0.85 apart -> expanded.
        this.scale = clamp(0.4 + (two.spread - 0.15) * 2.1, 0.4, 1.9)
        mode = 'spread'
      }
    } else {
      const rec = recognizeHand(landmarks)
      raw = rec.gesture
      confidence = rec.confidence
      position = palmCenter(landmarks)
      this.lastPinchDistance = rec.pinchDistance
    }

    const out = this.stabilizer.update(raw, confidence, now)
    this.applyTransitions(out, engine)

    // Pinch: thumb-index distance sets the size, only while pinch is the
    // confirmed gesture, so resizing never fights shape switching.
    if (out.gesture === 'pinch' && hands === 1) {
      this.scale = clamp(0.45 + this.lastPinchDistance * 1.1, 0.45, 2)
    }

    // Hand position -> formation position. The preview is mirrored, so flip
    // x to make the formation follow your hand like a mirror.
    let roll = hands === 1 ? handRoll(landmarks) : 0
    roll = Math.abs(roll) < ROLL_DEADZONE ? 0 : clamp(roll - Math.sign(roll) * ROLL_DEADZONE, -MAX_ROLL, MAX_ROLL)
    engine?.setHandTarget({
      x: (0.5 - position.x) * 5,
      y: (0.5 - position.y) * 3.2,
      roll,
      scale: this.scale,
    })

    this.publish({ hands, gesture: out.gesture, raw, mode })
  }

  /** React to the stable gesture changing. */
  applyTransitions(out, engine) {
    if (!out.changed || !engine) return
    if (out.burst) {
      engine.explode('galaxy')
      return
    }
    const formation = GESTURE_TO_FORMATION[out.gesture]
    if (formation) engine.setFormation(formation)
  }

  /** Only touch the store when something visible changed. */
  publish(next) {
    const cur = gestureStore.get()
    if (cur.hands !== next.hands || cur.gesture !== next.gesture || cur.raw !== next.raw || cur.mode !== next.mode) {
      gestureStore.set(next)
    }
  }

  reset() {
    this.stabilizer.reset()
    this.scale = 1
    this.engineRef.current?.setHandTarget(null)
    this.publish({ hands: 0, gesture: null, raw: null, mode: null })
  }
}
