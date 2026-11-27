/**
 * Morphing: move every particle a little closer to its target each frame.
 *
 * Instead of a fixed-length tween, each particle eases exponentially toward
 * its target position and colour (see dampFactor). This has two nice
 * properties:
 *  1. A new formation can be requested mid-transition; particles simply
 *     re-aim from wherever they currently are, with no visual "jump".
 *  2. It is frame-rate independent.
 *
 * Each particle also has its own speed multiplier, so particles arrive at
 * slightly different times and the shape appears to "flow" into place.
 *
 * @param {{positions: Float32Array, targets: Float32Array,
 *          colors: Float32Array, targetColors: Float32Array,
 *          speeds: Float32Array}} state  (positions/colors are modified)
 * @returns {number} the largest remaining position distance on any axis, so
 *                   the caller can skip GPU uploads once everything settled.
 */
export function stepMorph({ positions, targets, colors, targetColors, speeds }, lambda, dt) {
  let maxDelta = 0
  const count = speeds.length
  for (let i = 0; i < count; i++) {
    const f = 1 - Math.exp(-lambda * speeds[i] * dt)
    const i3 = i * 3
    for (let k = i3; k < i3 + 3; k++) {
      const delta = targets[k] - positions[k]
      positions[k] += delta * f
      colors[k] += (targetColors[k] - colors[k]) * f
      const abs = delta < 0 ? -delta : delta
      if (abs > maxDelta) maxDelta = abs
    }
  }
  return maxDelta
}
