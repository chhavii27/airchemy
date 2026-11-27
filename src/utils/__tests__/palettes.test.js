import { describe, it, expect } from 'vitest'
import { PALETTES, colorize, hexToLinear } from '../palettes.js'

describe('hexToLinear', () => {
  it('converts sRGB hex to linear light', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0])
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1])
    // sRGB mid-grey (#808080) is ~0.216 in linear light.
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2158, 3)
  })
})

describe('colorize', () => {
  const stops = [
    [0, '#ff0000'],
    [1, '#0000ff'],
  ]
  const noVariance = () => 0.8 // variance factor = 0.8 + 0.8 * 0.25 = 1.0

  it('maps mix 0 and 1 to the end colours and blends in between', () => {
    const c = colorize(new Float32Array([0, 0.5, 1]), stops, noVariance)
    expect([...c.slice(0, 3)]).toEqual([1, 0, 0])
    expect(c[3]).toBeCloseTo(0.5)
    expect(c[5]).toBeCloseTo(0.5)
    expect([...c.slice(6, 9)]).toEqual([0, 0, 1])
  })

  it('handles multi-stop palettes and stays finite', () => {
    for (const palette of Object.values(PALETTES)) {
      const mix = Float32Array.from({ length: 101 }, (_, i) => i / 100)
      const c = colorize(mix, palette.stops)
      expect(c.length).toBe(303)
      expect(c.every((v) => Number.isFinite(v) && v >= 0 && v <= 1.2)).toBe(true)
    }
  })

  it('palette stops are sorted and span 0..1', () => {
    for (const { stops } of Object.values(PALETTES)) {
      expect(stops[0][0]).toBe(0)
      expect(stops[stops.length - 1][0]).toBe(1)
      for (let k = 1; k < stops.length; k++) expect(stops[k][0]).toBeGreaterThan(stops[k - 1][0])
    }
  })
})
