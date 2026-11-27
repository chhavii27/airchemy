/**
 * Particle formation generators.
 *
 * Every generator is a pure function: (count, seed) -> { positions, mix }
 *   positions: Float32Array(count * 3)  x, y, z for each particle
 *   mix:       Float32Array(count)      0..1 "which part of the shape is
 *                                       this?" — mapped to colour by the
 *                                       formation's palette (palettes.js)
 *
 * Shapes are built from maths (parametric surfaces, implicit surfaces,
 * spirals, random walks) rather than images, so they work at any particle
 * count and are genuinely 3D. Coordinates are in world units; the camera
 * frames roughly -2.5..2.5. Idle animations live in the vertex shader.
 */
import { TAU, mulberry32 } from './mathHelpers.js'
import { PALETTES } from './palettes.js'

// Orientation constants shared with the shader (it un-rotates shapes to
// animate rings and spiral arms in their own plane).
export const SATURN_TILT = 0.42 // ring plane tipped toward the viewer (about X)
export const SATURN_LEAN = -0.35 // whole planet leaned sideways (about Z)
export const GALAXY_TILT = 0.55 // galaxy disc tipped toward the viewer (about X)

function createBuffers(count) {
  return { positions: new Float32Array(count * 3), mix: new Float32Array(count) }
}

function writePoint(buffers, i, x, y, z, m) {
  buffers.positions[i * 3] = x
  buffers.positions[i * 3 + 1] = y
  buffers.positions[i * 3 + 2] = z
  buffers.mix[i] = Math.min(1, Math.max(0, m))
}

/** Approximately normal random number (sum of uniforms), mean 0, sd ~0.5. */
function gaussian(rand) {
  return (rand() + rand() + rand() + rand() - 2) / 1.15
}

/** Uniform random unit vector. */
function randomDirection(rand) {
  const u = rand() * 2 - 1
  const a = rand() * TAU
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(a), u, s * Math.sin(a)]
}

/**
 * 1. Electric Plasma — a crackling energy sphere.
 *  - shell (60%): golden-angle (Fibonacci) spiral spreads points evenly
 *  - lightning (22%): jagged bolts from the core to the surface, made by a
 *    random walk that bends sideways most in the middle of each bolt
 *  - core (13%): dense white-hot centre
 *  - corona (5%): faint halo just outside the shell
 */
export function energySphere(count, seed = 1) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const R = 1.45
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const nShell = Math.floor(count * 0.6)
  const nBolts = Math.floor(count * 0.22)
  const nCore = Math.floor(count * 0.13) // the remaining ~5% form a faint corona

  // Pre-build lightning bolts as polylines.
  const BOLTS = 16
  const SEGMENTS = 12
  const bolts = []
  for (let b = 0; b < BOLTS; b++) {
    const dir = randomDirection(rand)
    const pts = []
    for (let s = 0; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS
      const wobble = Math.sin(Math.PI * t) * 0.22
      const r = 0.12 + t * (R - 0.12)
      pts.push([
        dir[0] * r + (rand() - 0.5) * wobble,
        dir[1] * r + (rand() - 0.5) * wobble,
        dir[2] * r + (rand() - 0.5) * wobble,
      ])
    }
    bolts.push(pts)
  }

  for (let i = 0; i < count; i++) {
    if (i < nShell) {
      const y = 1 - ((i + 0.5) / nShell) * 2
      const ring = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i
      const r = R * (1 + (rand() - 0.5) * 0.05)
      writePoint(out, i, Math.cos(theta) * ring * r, y * r, Math.sin(theta) * ring * r, 0.38 + rand() * 0.3)
    } else if (i < nShell + nBolts) {
      const pts = bolts[i % BOLTS]
      const f = rand() * SEGMENTS
      const s = Math.min(SEGMENTS - 1, Math.floor(f))
      const t = f - s
      const a = pts[s]
      const b = pts[s + 1]
      writePoint(
        out,
        i,
        a[0] + (b[0] - a[0]) * t + gaussian(rand) * 0.012,
        a[1] + (b[1] - a[1]) * t + gaussian(rand) * 0.012,
        a[2] + (b[2] - a[2]) * t + gaussian(rand) * 0.012,
        0.75 + rand() * 0.2,
      )
    } else if (i < nShell + nBolts + nCore) {
      const d = randomDirection(rand)
      const r = Math.abs(gaussian(rand)) * 0.22
      writePoint(out, i, d[0] * r, d[1] * r, d[2] * r, 0.93 + rand() * 0.07)
    } else {
      const d = randomDirection(rand)
      const r = R * (1.04 + rand() ** 2 * 0.25)
      writePoint(out, i, d[0] * r, d[1] * r, d[2] * r, 0.05 + rand() * 0.25)
    }
  }
  return out
}

/**
 * 2. Mystic Wings — butterfly from Temple Fay's butterfly curve:
 *    r(t) = e^cos(t) - 2cos(4t) + sin^5(t/12),  t in [0, 24*pi]
 * The curve is the wing outline. Wings are filled (sqrt for even density),
 * with bright edges, radiating veins, a segmented body and curled antennae.
 * Wings fold into a shallow V so the butterfly is 3D; the shader flaps them.
 */
export function butterfly(count, seed = 4) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const scale = 0.48
  const nBody = Math.floor(count * 0.05)
  const nAntennae = Math.floor(count * 0.025)
  const nVeins = Math.floor(count * 0.1)
  const VEINS = 44
  const curve = (t) => Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.sin(t / 12) ** 5

  for (let i = 0; i < count; i++) {
    if (i < nBody) {
      // Segmented body: thickness pulses along its length.
      const t = rand()
      const thickness = 0.07 * Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 6)))
      const a = rand() * TAU
      writePoint(out, i, Math.cos(a) * thickness, (t - 0.55) * 1.7, Math.sin(a) * thickness - 0.3, 0.02 + rand() * 0.08)
    } else if (i < nBody + nAntennae) {
      // Two curling antennae from the head, denser at the club tips.
      const side = i % 2 ? 1 : -1
      const s = rand() < 0.3 ? 0.85 + rand() * 0.15 : rand()
      writePoint(out, i, side * (0.04 + s * 0.32), 0.62 + s * 0.55 - s * s * 0.2, -0.3 - s * 0.12, 0.9 + rand() * 0.1)
    } else {
      const isVein = i < nBody + nAntennae + nVeins
      const t = isVein ? (Math.floor(rand() * VEINS) / VEINS) * 24 * Math.PI : rand() * 24 * Math.PI
      const r = curve(t)
      const fill = isVein ? rand() : rand() < 0.3 ? 0.97 + rand() * 0.03 : Math.sqrt(rand())
      const x = Math.sin(t) * r * fill * scale
      const y = Math.cos(t) * r * fill * scale
      // V-fold plus a gentle cup across each wing.
      const z = Math.abs(x) * 0.45 - 0.3 + Math.sin(fill * Math.PI) * 0.08
      const m = isVein ? 0.86 : fill > 0.96 ? 0.82 : 0.18 + fill * 0.55
      writePoint(out, i, x, y, z, m)
    }
  }
  return out
}

/**
 * 3. Divine Blossom — lotus: four rings of parametric petals, a golden
 * seed pod, and faint ripple rings on the "water" beneath.
 *
 * Each petal: u in [0,1] runs base -> tip, v in [-1,1] across its width.
 * Width follows sin(pi*u) so petals are pointed at both ends; petals tilt up
 * (inner rings more upright), cup across their width and curl outward.
 */
export const LOTUS_LAYERS = [
  { petals: 5, length: 0.95, tilt: 1.2, width: 0.36, offset: 0 },
  { petals: 8, length: 1.3, tilt: 0.92, width: 0.44, offset: 0.4 },
  { petals: 10, length: 1.6, tilt: 0.58, width: 0.5, offset: 0.1 },
  { petals: 12, length: 1.85, tilt: 0.28, width: 0.5, offset: 0.27 },
]

export function lotusFlower(count, seed = 2) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const nCenter = Math.floor(count * 0.08)
  const nRipples = Math.floor(count * 0.06)

  const petals = []
  for (const layer of LOTUS_LAYERS) {
    for (let k = 0; k < layer.petals; k++) {
      petals.push({ ...layer, angle: (k / layer.petals) * TAU + layer.offset })
    }
  }

  for (let i = 0; i < count; i++) {
    if (i < nCenter) {
      const r = Math.sqrt(rand()) * 0.28
      const a = rand() * TAU
      writePoint(out, i, Math.cos(a) * r, -0.35 + rand() * 0.18 + (0.28 - r) * 0.3, Math.sin(a) * r, 0.9 + rand() * 0.1)
      continue
    }
    if (i < nCenter + nRipples) {
      // Three concentric ripple rings below the flower.
      const ring = Math.floor(rand() * 3)
      const r = 1.95 + ring * 0.2 + gaussian(rand) * 0.015
      const a = rand() * TAU
      writePoint(out, i, Math.cos(a) * r, -0.62 + gaussian(rand) * 0.01, Math.sin(a) * r, 0.25 + rand() * 0.15)
      continue
    }

    const petal = petals[i % petals.length]
    const u = Math.sqrt(rand())
    // 30% of points hug the petal edge so the outline reads clearly.
    const v = rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) * (0.9 + rand() * 0.1) : rand() * 2 - 1
    const halfWidth = Math.sin(Math.PI * u ** 0.85) * petal.width
    const lateral = v * halfWidth
    const along = u * petal.length
    const radial = along * Math.cos(petal.tilt) + u * u * 0.18 * petal.length + 0.12
    const height = along * Math.sin(petal.tilt) - u * u * 0.12 * petal.length + v * v * halfWidth * 0.35
    const cos = Math.cos(petal.angle)
    const sin = Math.sin(petal.angle)
    writePoint(out, i, radial * cos - lateral * sin, height - 0.45, radial * sin + lateral * cos, u * 0.8)
  }
  return out
}

/**
 * 4. Golden Orbit — Saturn: a banded planet and a ring system with
 * ringlets (density ripples) and a Cassini division gap.
 * Ring radius is sampled with sqrt so area density is even, then thinned by
 * a sine "ringlet" pattern using rejection sampling.
 */
export function saturn(count, seed = 3) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const nPlanet = Math.floor(count * 0.36)
  const R = 0.85
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const cosT = Math.cos(SATURN_TILT)
  const sinT = Math.sin(SATURN_TILT)
  const cosL = Math.cos(SATURN_LEAN)
  const sinL = Math.sin(SATURN_LEAN)

  for (let i = 0; i < count; i++) {
    let x
    let y
    let z
    let m
    if (i < nPlanet) {
      const yN = 1 - ((i + 0.5) / nPlanet) * 2
      const ring = Math.sqrt(1 - yN * yN)
      const theta = goldenAngle * i
      x = Math.cos(theta) * ring * R
      y = yN * R
      z = Math.sin(theta) * ring * R
      // Latitude bands of different shades.
      m = 0.05 + 0.42 * (0.5 + 0.5 * Math.sin(yN * 11 + Math.sin(yN * 3) * 2)) + (rand() - 0.5) * 0.05
    } else {
      let r
      do {
        const outer = rand() < 0.55
        const r0 = outer ? 1.72 : 1.12
        const r1 = outer ? 2.3 : 1.6
        r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0))
      } while (rand() > 0.45 + 0.55 * Math.sin(r * 34) ** 2)
      const a = rand() * TAU
      const fx = Math.cos(a) * r
      const fz = Math.sin(a) * r
      const fy = gaussian(rand) * 0.012
      x = fx
      y = fy * cosT - fz * sinT
      z = fy * sinT + fz * cosT
      m = 0.56 + ((r - 1.12) / 1.18) * 0.44
    }
    writePoint(out, i, x * cosL - y * sinL, x * sinL + y * cosL, z, m)
  }
  return out
}

/**
 * 5. Cosmic Infinity — spiral galaxy: a glowing bulge, three spiral arms
 * whose angle grows with radius (the twist that makes the spiral), and a
 * sparse halo of distant stars around it.
 */
export function spiralGalaxy(count, seed = 5) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const arms = 3
  const nBulge = Math.floor(count * 0.15)
  const nHalo = Math.floor(count * 0.03)
  const maxR = 2.15
  const cosT = Math.cos(GALAXY_TILT)
  const sinT = Math.sin(GALAXY_TILT)

  for (let i = 0; i < count; i++) {
    let x
    let y
    let z
    let m
    if (i < nBulge) {
      x = gaussian(rand) * 0.3
      y = gaussian(rand) * 0.16
      z = gaussian(rand) * 0.3
      m = 0.86 + rand() * 0.14
    } else if (i < nBulge + nHalo) {
      const d = randomDirection(rand)
      const r = 1.2 + rand() * 1.2
      x = d[0] * r
      y = d[1] * r * 0.55
      z = d[2] * r
      m = 0.2 + rand() * 0.35
    } else {
      const r = 0.15 + rand() ** 0.75 * (maxR - 0.15)
      const arm = Math.floor(rand() * arms)
      const scatter = gaussian(rand) * (0.35 / (r + 0.6))
      const a = (arm / arms) * TAU + r * 2.4 + scatter
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      y = gaussian(rand) * 0.08 * (1 - r / (maxR + 0.4))
      // Bright knots along the arm centre, dimmer between arms.
      m = 0.82 - (r / maxR) * 0.72 + (Math.abs(scatter) < 0.05 ? 0.12 : 0) + (rand() - 0.5) * 0.08
    }
    writePoint(out, i, x, y * cosT - z * sinT, y * sinT + z * cosT, m)
  }
  return out
}

/**
 * 6. Eternal Love — a true 3D heart from the implicit heart surface
 *    (x² + 9/4·d² + h² − 1)³ − x²·h³ − 9/80·d²·h³ = 0
 * (h = height, d = depth). Random points are kept if they fall in a thin
 * shell just inside the surface (rejection sampling), giving a crisp
 * outline from any angle, plus a softer glowing interior.
 */
export function floatingHeart(count, seed = 6) {
  const rand = mulberry32(seed)
  const out = createBuffers(count)
  const S = 1.22
  const nInterior = Math.floor(count * 0.22)
  const f = (x, d, h) => {
    const a = x * x + 2.25 * d * d + h * h - 1
    return a * a * a - x * x * h * h * h - 0.1125 * d * d * h * h * h
  }

  let i = 0
  let guard = 0
  while (i < count && guard++ < count * 400) {
    const x = (rand() * 2 - 1) * 1.2
    const d = (rand() * 2 - 1) * 0.75
    const h = rand() * 2.35 - 1.05
    const v = f(x, d, h)
    if (v > 0) continue
    const interior = i < nInterior
    if (!interior && v < -0.035) continue // keep only a thin surface shell
    const m = interior ? 0.8 + rand() * 0.2 : 0.22 + ((h + 1) / 2.25) * 0.42 + rand() * 0.08
    writePoint(out, i, x * S, (h - 0.12) * S, d * S, m)
    i++
  }
  // Safety net (never expected): fill any remainder at the centre.
  for (; i < count; i++) writePoint(out, i, 0, 0, 0, 0.9)
  return out
}

/**
 * Registry used by the engine and UI. Adding a formation = adding an entry.
 * `label` is the short button text, `name` the poetic title, `hint` the
 * gesture, and `palette` the colour configuration from palettes.js.
 */
export const FORMATIONS = {
  sphere: { label: 'Sphere', hint: 'Closed fist', generate: energySphere },
  butterfly: { label: 'Butterfly', hint: 'Two fingers', generate: butterfly },
  lotus: { label: 'Lotus', hint: 'Three fingers', generate: lotusFlower },
  saturn: { label: 'Saturn', hint: 'Open palm', generate: saturn },
  galaxy: { label: 'Galaxy', hint: 'Fist → burst open', generate: spiralGalaxy },
  heart: { label: 'Heart', hint: 'Two-hand heart', generate: floatingHeart },
}
for (const id of Object.keys(FORMATIONS)) {
  FORMATIONS[id].palette = PALETTES[id]
  FORMATIONS[id].name = PALETTES[id].name
}

export const FORMATION_IDS = Object.keys(FORMATIONS)
