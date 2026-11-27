/**
 * Colour palettes — one per formation.
 *
 * Each generator gives every particle a `mix` value (0..1) describing *what
 * part* of the shape it is (e.g. lotus petal base = 0, petal tip = 0.8,
 * golden centre = 0.95). The palette maps that value to a colour through
 * gradient `stops`, so each formation has its own multicolour distribution.
 *
 * To change a formation's colours, edit the hex codes below.
 * `sparkle` (0..1) controls how much that formation glitters.
 */
export const PALETTES = {
  sphere: {
    name: 'Electric Plasma',
    sparkle: 0.45,
    stops: [
      [0.0, '#061266'], // faint outer corona: deep electric blue
      [0.35, '#1638e0'], // plasma shell
      [0.6, '#1fa8e6'], // cyan surface currents
      [0.8, '#7a3cf0'], // violet lightning
      [1.0, '#cfe0ff'], // hot core (small area only)
    ],
  },
  butterfly: {
    name: 'Mystic Wings',
    sparkle: 0.35,
    stops: [
      [0.0, '#0aa596'], // teal body
      [0.25, '#2448d6'], // inner wing blue
      [0.5, '#8a1fe0'], // purple mid-wing
      [0.7, '#e0209e'], // magenta wing glow
      [0.85, '#6a2fe0'], // violet edges and veins
      [1.0, '#d7c6ff'], // lilac antennae tips
    ],
  },
  lotus: {
    name: 'Divine Blossom',
    sparkle: 0.3,
    stops: [
      [0.0, '#8a0c3c'], // deep rose petal base
      [0.3, '#e02a78'], // rose pink
      [0.6, '#f070a8'], // pink
      [0.8, '#ffb8d6'], // soft pink petal tips
      [0.88, '#f0a820'], // gold
      [1.0, '#ffd76a'], // golden centre
    ],
  },
  saturn: {
    name: 'Golden Orbit',
    sparkle: 0.25,
    stops: [
      [0.0, '#3d2008'], // dark bronze bands
      [0.22, '#8f5512'], // amber
      [0.4, '#d49a2e'], // gold
      [0.5, '#f0c46a'], // pale gold bands
      [0.56, '#5c4020'], // dim inner ring
      [0.75, '#c8963e'], // golden rings
      [1.0, '#f2d79a'], // bright outer ring dust
    ],
  },
  galaxy: {
    name: 'Cosmic Infinity',
    sparkle: 0.45,
    stops: [
      [0.0, '#120840'], // deep indigo rim
      [0.3, '#2632d6'], // blue arms
      [0.55, '#7f2ae0'], // purple
      [0.75, '#e03aa8'], // pink star-forming regions
      [0.9, '#f2a868'], // warm core
      [1.0, '#fff0dc'], // nucleus (small area only)
    ],
  },
  heart: {
    name: 'Eternal Love',
    sparkle: 0.3,
    stops: [
      [0.0, '#3a000f'], // deep crimson shadow
      [0.3, '#a0062c'], // crimson
      [0.55, '#e01c4c'], // rose red
      [0.78, '#f25a85'], // pink
      [1.0, '#ffc4d6'], // inner glow
    ],
  },
}

/** "#rrggbb" -> [r, g, b] in linear light (what the GPU blends in). */
export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
}

/**
 * Convert per-particle mix values into per-particle RGB colours.
 * A small per-particle brightness variation keeps large areas from looking flat.
 * @param {Float32Array} mix
 * @param {[number, string][]} stops  sorted [position, hex] pairs
 * @param {() => number} rand
 * @returns {Float32Array} length mix.length * 3
 */
export function colorize(mix, stops, rand = Math.random) {
  const lin = stops.map(([pos, hex]) => [pos, hexToLinear(hex)])
  const out = new Float32Array(mix.length * 3)
  for (let i = 0; i < mix.length; i++) {
    const m = mix[i]
    let k = 0
    while (k < lin.length - 2 && m > lin[k + 1][0]) k++
    const [p0, c0] = lin[k]
    const [p1, c1] = lin[k + 1]
    const t = Math.min(1, Math.max(0, (m - p0) / (p1 - p0 || 1)))
    const variance = 0.8 + rand() * 0.25
    for (let c = 0; c < 3; c++) out[i * 3 + c] = (c0[c] + (c1[c] - c0[c]) * t) * variance
  }
  return out
}
