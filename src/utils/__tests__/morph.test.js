import { describe, it, expect } from 'vitest'
import { stepMorph } from '../../engine/morph.js'
import { dampFactor, mulberry32 } from '../mathHelpers.js'

function makeState(n) {
  return {
    positions: new Float32Array(n * 3).fill(0),
    targets: new Float32Array(n * 3).fill(1),
    colors: new Float32Array(n * 3).fill(0),
    targetColors: new Float32Array(n * 3).fill(1),
    speeds: new Float32Array(n).fill(1),
  }
}

describe('stepMorph', () => {
  it('moves particles toward targets without overshooting', () => {
    const s = makeState(10)
    stepMorph(s, 3, 0.016)
    for (const p of s.positions) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('converges and reports the remaining distance', () => {
    const s = makeState(10)
    let remaining = Infinity
    for (let i = 0; i < 600; i++) remaining = stepMorph(s, 3, 1 / 60)
    expect(remaining).toBeLessThan(0.0005)
    expect(s.colors[0]).toBeCloseTo(1, 3)
  })

  it('is frame-rate independent (30 FPS vs 120 FPS end in the same place)', () => {
    const a = makeState(1)
    const b = makeState(1)
    for (let i = 0; i < 30; i++) stepMorph(a, 3, 1 / 30) // 1 second at 30 FPS
    for (let i = 0; i < 120; i++) stepMorph(b, 3, 1 / 120) // 1 second at 120 FPS
    expect(a.positions[0]).toBeCloseTo(b.positions[0], 5)
  })
})

describe('math helpers', () => {
  it('dampFactor is 0 for no time and approaches 1', () => {
    expect(dampFactor(5, 0)).toBe(0)
    expect(dampFactor(5, 10)).toBeCloseTo(1, 6)
  })

  it('mulberry32 is seeded and in [0,1)', () => {
    const a = mulberry32(1)
    const b = mulberry32(1)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v >= 0 && v < 1).toBe(true)
    }
  })
})
