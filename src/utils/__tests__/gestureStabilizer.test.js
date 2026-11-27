import { describe, it, expect } from 'vitest'
import { GestureStabilizer } from '../gestureStabilizer.js'

/** Feed the same raw gesture every 33 ms (≈30 Hz) for `ms`, return last output. */
function feed(stab, raw, ms, start, confidence = 0.9) {
  let out
  let t = start
  for (; t <= start + ms; t += 33) out = stab.update(raw, confidence, t)
  return { out, t }
}

describe('GestureStabilizer', () => {
  it('only accepts a gesture after it is held for holdMs', () => {
    const stab = new GestureStabilizer({ holdMs: 200 })
    expect(stab.update('fist', 0.9, 0).gesture).toBeNull()
    expect(stab.update('fist', 0.9, 150).gesture).toBeNull()
    const out = stab.update('fist', 0.9, 210)
    expect(out.gesture).toBe('fist')
    expect(out.changed).toBe(true)
    expect(stab.update('fist', 0.9, 240).changed).toBe(false)
  })

  it('ignores brief flickers between gestures', () => {
    const stab = new GestureStabilizer({ holdMs: 200 })
    let { t } = feed(stab, 'open', 300, 0)
    // Alternate noisy readings; none lasts long enough.
    for (const raw of ['two', 'three', 'two', 'open', 'three']) {
      expect(stab.update(raw, 0.9, (t += 33)).gesture).toBe('open')
    }
  })

  it('ignores low-confidence readings', () => {
    const stab = new GestureStabilizer({ holdMs: 100, minConfidence: 0.5 })
    expect(feed(stab, 'three', 500, 0, 0.2).out.gesture).toBeNull()
  })

  it('keeps the gesture through a short tracking dropout, then clears it', () => {
    const stab = new GestureStabilizer({ holdMs: 100, lostMs: 600 })
    const { t } = feed(stab, 'three', 300, 0)
    expect(stab.update(null, 0, t + 300).gesture).toBe('three')
    const cleared = stab.update(null, 0, t + 700)
    expect(cleared.gesture).toBeNull()
    expect(cleared.changed).toBe(true)
  })

  it('detects a burst when a held fist is opened quickly', () => {
    const stab = new GestureStabilizer({ holdMs: 200, minFistMs: 250 })
    const { t } = feed(stab, 'fist', 800, 0)
    stab.update('three', 0.9, t + 33) // transition frame
    const { out } = feed(stab, 'open', 250, t + 66)
    expect(out.gesture).toBe('open')
    expect(out.burst).toBe(true)
  })

  it('does not burst when the fist opens slowly', () => {
    const stab = new GestureStabilizer({ holdMs: 200, burstWindowMs: 500 })
    let { t } = feed(stab, 'fist', 800, 0)
    t = feed(stab, 'none', 600, t + 33).t // hand relaxing, no clear gesture
    const { out } = feed(stab, 'open', 250, t + 33)
    expect(out.gesture).toBe('open')
    expect(out.burst).toBe(false)
  })

  it('makes pinch sticky so a hard pinch does not flip to fist', () => {
    const stab = new GestureStabilizer({ holdMs: 200, stickyMs: { pinch: 450 } })
    const { t } = feed(stab, 'pinch', 300, 0)
    expect(feed(stab, 'fist', 300, t + 33).out.gesture).toBe('pinch')
  })
})
