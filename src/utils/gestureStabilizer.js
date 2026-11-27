/**
 * Turns noisy per-frame gesture guesses into stable, intentional gestures.
 *
 * Raw recognition flickers: while you open your hand it may briefly read
 * "two" and "three" on the way to "open". The stabilizer only accepts a new
 * gesture after it has been seen continuously, with enough confidence, for
 * a short hold time (debouncing). It also:
 *  - keeps the last gesture for a moment if the hand disappears (a dropped
 *    frame shouldn't reset everything),
 *  - makes continuous controls (pinch) "sticky" so a hard pinch that briefly
 *    looks like a fist doesn't swap the formation,
 *  - detects a burst: a held fist that is quickly opened.
 */
export class GestureStabilizer {
  constructor({
    holdMs = 200,
    minConfidence = 0.3,
    lostMs = 600,
    stickyMs = { pinch: 450 },
    minFistMs = 250,
    burstWindowMs = 500,
  } = {}) {
    Object.assign(this, { holdMs, minConfidence, lostMs, stickyMs, minFistMs, burstWindowMs })
    this.reset()
  }

  reset() {
    this.stable = null
    this.stableSince = 0
    this.pending = null
    this.pendingSince = 0
    this.lastHandTime = -Infinity
    this.lastFistTime = -Infinity
  }

  /**
   * @param {string|null} raw  gesture from recognizeHand, or null if no hand
   * @param {number} confidence 0..1
   * @param {number} now        timestamp in ms
   * @returns {{ gesture: string|null, changed: boolean, burst: boolean }}
   */
  update(raw, confidence, now) {
    const before = this.stable
    let burst = false

    if (raw === null) {
      // No hand. Keep the last gesture briefly, then clear it.
      this.pending = null
      if (this.stable !== null && now - this.lastHandTime > this.lostMs) {
        this.stable = null
        this.stableSince = now
      }
      return { gesture: this.stable, changed: this.stable !== before, burst }
    }

    this.lastHandTime = now
    if (raw === 'fist') this.lastFistTime = now
    const candidate = raw !== 'none' && confidence >= this.minConfidence ? raw : null

    if (candidate === null || candidate === this.stable) {
      // Ambiguous frame or same gesture: nothing new to switch to.
      this.pending = null
    } else {
      if (candidate !== this.pending) {
        this.pending = candidate
        this.pendingSince = now
      }
      const required = this.stickyMs[this.stable] ?? this.holdMs
      if (now - this.pendingSince >= required) {
        const wasFist = this.stable === 'fist'
        const fistHeld = now - this.stableSince
        // Burst: fist held for a moment, then opened within a short window.
        if (
          candidate === 'open' &&
          wasFist &&
          fistHeld >= this.minFistMs + this.holdMs &&
          now - this.lastFistTime <= this.burstWindowMs
        ) {
          burst = true
        }
        this.stable = candidate
        this.stableSince = now
        this.pending = null
      }
    }
    return { gesture: this.stable, changed: this.stable !== before, burst }
  }
}
