import { describe, it, expect } from 'vitest'
import { FORMATIONS, FORMATION_IDS, energySphere, lotusFlower, saturn, floatingHeart, SATURN_TILT, SATURN_LEAN } from '../particleShapes.js'

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k])
      max[k] = Math.max(max[k], positions[i + k])
    }
  }
  return { min, max }
}

describe.each(FORMATION_IDS)('formation "%s"', (id) => {
  const { generate } = FORMATIONS[id]

  it.each([1, 500, 15000])('produces correctly sized, finite buffers for %i particles', (count) => {
    const { positions, mix } = generate(count)
    expect(positions).toBeInstanceOf(Float32Array)
    expect(positions.length).toBe(count * 3)
    expect(mix.length).toBe(count)
    expect(positions.every(Number.isFinite)).toBe(true)
    expect(mix.every((m) => m >= 0 && m <= 1)).toBe(true)
  })

  it('has a named multicolour palette', () => {
    const { palette } = FORMATIONS[id]
    expect(palette.name).toBeTruthy()
    expect(palette.stops.length).toBeGreaterThanOrEqual(4)
  })

  it('is deterministic for the same seed', () => {
    expect(generate(300, 42).positions).toEqual(generate(300, 42).positions)
  })

  it('fits inside the camera frame and is genuinely 3D', () => {
    const { min, max } = bounds(generate(5000).positions)
    for (let k = 0; k < 3; k++) {
      expect(min[k]).toBeGreaterThan(-2.6)
      expect(max[k]).toBeLessThan(2.6)
      expect(max[k] - min[k]).toBeGreaterThan(0.5) // not flat on any axis
    }
  })
})

describe('energySphere (Electric Plasma)', () => {
  it('places the first 55% of particles on a shell of radius ~1.45', () => {
    const count = 4000
    const { positions } = energySphere(count)
    for (let i = 0; i < Math.floor(count * 0.55); i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      expect(r).toBeGreaterThan(1.4)
      expect(r).toBeLessThan(1.5)
    }
  })
})

describe('saturn (Golden Orbit)', () => {
  it('has a Cassini gap between the inner and outer rings', () => {
    const count = 6000
    const { positions } = saturn(count)
    // Undo lean (about Z) and tilt (about X) to measure ring radius in-plane.
    for (let i = Math.floor(count * 0.36); i < count; i++) {
      let x = positions[i * 3]
      let y = positions[i * 3 + 1]
      const z0 = positions[i * 3 + 2]
      const cl = Math.cos(-SATURN_LEAN)
      const sl = Math.sin(-SATURN_LEAN)
      ;[x, y] = [x * cl - y * sl, x * sl + y * cl]
      const ct = Math.cos(-SATURN_TILT)
      const st = Math.sin(-SATURN_TILT)
      const z = y * st + z0 * ct
      const r = Math.hypot(x, z)
      expect(r > 1.6 + 1e-3 && r < 1.72 - 1e-3).toBe(false)
    }
  })
})

describe('floatingHeart (Eternal Love)', () => {
  it('is taller and wider than it is deep, and fills every particle', () => {
    const { positions } = floatingHeart(5000)
    const { min, max } = bounds(positions)
    expect(max[0] - min[0]).toBeGreaterThan(max[2] - min[2])
    expect(max[1] - min[1]).toBeGreaterThan(max[2] - min[2])
    // The safety-net fallback (0,0,0) should never be needed.
    let origin = 0
    for (let i = 0; i < 5000; i++) if (positions[i * 3] === 0 && positions[i * 3 + 1] === 0 && positions[i * 3 + 2] === 0) origin++
    expect(origin).toBe(0)
  })
})

describe('lotusFlower', () => {
  it('opens outward: wider than it is tall', () => {
    const { min, max } = bounds(lotusFlower(6000).positions)
    expect(max[0] - min[0]).toBeGreaterThan(max[1] - min[1])
  })
})

