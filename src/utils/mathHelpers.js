/**
 * Small, pure math helpers shared by the engine and gesture logic.
 * Everything here is deterministic and unit-testable.
 */

export const TAU = Math.PI * 2

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const lerp = (a, b, t) => a + (b - a) * t

/**
 * Frame-rate independent smoothing factor.
 *
 * A naive `current += (target - current) * 0.1` converges faster at 120 FPS
 * than at 30 FPS. Using an exponential decay based on elapsed time (dt, in
 * seconds) makes the motion look identical at any frame rate.
 *
 * @param {number} lambda  How "snappy" the motion is (higher = faster).
 * @param {number} dt      Seconds since the last frame.
 * @returns {number} A blend factor in [0, 1).
 */
export const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt)

export const damp = (current, target, lambda, dt) =>
  lerp(current, target, dampFactor(lambda, dt))

/**
 * Seeded pseudo-random generator (mulberry32).
 * Same seed -> same sequence, so particle shapes are reproducible in tests.
 * @param {number} seed
 * @returns {() => number} function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
