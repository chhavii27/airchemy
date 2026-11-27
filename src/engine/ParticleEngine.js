import * as THREE from 'three'
import { FORMATIONS } from '../utils/particleShapes.js'
import { colorize } from '../utils/palettes.js'
import { mulberry32, dampFactor } from '../utils/mathHelpers.js'
import { particleVertexShader, particleFragmentShader } from '../shaders/particleShaders.js'
import { stepMorph } from './morph.js'

export const DEFAULT_SETTINGS = {
  count: 12000, // the maximum; adaptive density may use fewer to stay smooth
  adaptive: true,
  size: 2.4,
  speed: 1,
  glow: 1,
  background: '#020308', // near-black
}

// Adaptive density: keep the frame rate smooth by adjusting particle count.
const ADAPT = { min: 3000, step: 0.8, grow: 1.15, lowFps: 45, highFps: 56, windows: 4, cooldownMs: 2500, growBlockMs: 12000 }
const WEIGHT_UNIFORMS = {
  sphere: 'uWSphere',
  butterfly: 'uWButterfly',
  lotus: 'uWLotus',
  saturn: 'uWSaturn',
  galaxy: 'uWGalaxy',
  heart: 'uWHeart',
}

const MORPH_LAMBDA = 2.6 // how quickly particles travel to a new formation
const IDLE_SPIN = 0.12 // radians/second of slow auto-rotation
const HAND_LAMBDA = 6 // how quickly the formation follows your hand
const NO_HAND = { x: 0, y: 0, roll: 0, scale: 1 }
const BURST_DURATION = 1.4 // seconds of Big Bang physics before reforming

/**
 * ParticleEngine owns everything Three.js: renderer, scene, camera, the
 * particle geometry/material and the render loop. It deliberately lives
 * outside React: React mounts it once and then only calls its methods.
 *
 * Usage:
 *   const engine = new ParticleEngine(containerEl, { onStats, onFormationChange })
 *   engine.setFormation('lotus')
 *   engine.setSettings({ size: 4 })
 *   engine.dispose()
 */
export class ParticleEngine {
  constructor(container, { settings = {}, onStats, onFormationChange } = {}) {
    this.container = container
    this.settings = { ...DEFAULT_SETTINGS, ...settings }
    this.onStats = onStats
    this.onFormationChange = onFormationChange
    this.formationId = 'sphere'
    this.formationCache = new Map() // `${id}:${count}` -> { positions, colors }
    this.settled = false
    // Phones and small screens start with fewer particles.
    const small = Math.min(window.innerWidth, window.innerHeight) < 700
    this.count = small ? Math.min(this.settings.count, 6000) : this.settings.count
    this.fpsHistory = []
    this.lastAdapt = 0
    this.growBlockedUntil = 0
    this.countCeiling = Infinity

    // Throws if WebGL is unavailable; the React wrapper catches and shows a fallback.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(this.settings.background, 1)
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
    this.camera.position.set(0, 0.4, 6)
    this.camera.lookAt(0, 0, 0)

    // The outer group follows the hand (position, roll, size); the inner
    // group handles the idle spin, so the two never interfere.
    this.group = new THREE.Group()
    this.spin = new THREE.Group()
    this.group.add(this.spin)
    this.scene.add(this.group)
    this.handTarget = { ...NO_HAND }

    this.burstTime = 0
    this.elapsed = 0
    this.weights = Object.fromEntries(Object.keys(WEIGHT_UNIFORMS).map((id) => [id, id === this.formationId ? 1 : 0]))
    this.sparkle = FORMATIONS[this.formationId].palette.sparkle

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // layers like paint: true colours, no white wash
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: this.settings.size },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uFloat: { value: 0.01 }, // gentle drift; small so outlines stay defined
        uGlow: { value: this.settings.glow },
        uIntensity: { value: 1 },
        uSparkle: { value: this.sparkle },
        uPulse: { value: 0 },
        uBurst: { value: 0 },
        ...Object.fromEntries(Object.entries(WEIGHT_UNIFORMS).map(([id, name]) => [name, { value: this.weights[id] }])),
      },
    })

    this.points = null
    this.buildParticles(this.count)

    this.timer = new THREE.Timer()
    this.timer.connect(document) // pauses timing correctly when the tab is hidden
    this.frames = 0
    this.statsTime = performance.now()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.animate = this.animate.bind(this)
    this.rafId = requestAnimationFrame(this.animate)
    this.onFormationChange?.(this.formationId)
  }

  /** Allocate buffers for `count` particles. Only runs when the count changes. */
  buildParticles(count) {
    const previous = this.buffers
    // Cached shapes for other particle counts are no longer useful.
    for (const key of this.formationCache.keys()) if (!key.endsWith(`:${count}`)) this.formationCache.delete(key)
    const rand = mulberry32(7)

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const random = new Float32Array(count)
    const speeds = new Float32Array(count)
    const jitter = new Float32Array(count * 3) // fixed random offsets (explosion spread)

    for (let i = 0; i < count; i++) {
      random[i] = rand()
      speeds[i] = 0.55 + rand() * 0.9
      jitter[i * 3] = rand() * 2 - 1
      jitter[i * 3 + 1] = rand() * 2 - 1
      jitter[i * 3 + 2] = rand() * 2 - 1
      if (previous && i < previous.speeds.length) {
        // Keep existing particles where they are so a count change is seamless.
        positions.set(previous.positions.subarray(i * 3, i * 3 + 3), i * 3)
        colors.set(previous.colors.subarray(i * 3, i * 3 + 3), i * 3)
      } else {
        // New particles start scattered in a wide, dark cloud and fly into place.
        positions[i * 3] = (rand() - 0.5) * 12
        positions[i * 3 + 1] = (rand() - 0.5) * 8
        positions[i * 3 + 2] = (rand() - 0.5) * 8
      }
    }

    const geometry = new THREE.BufferGeometry()
    const positionAttr = new THREE.BufferAttribute(positions, 3)
    const colorAttr = new THREE.BufferAttribute(colors, 3)
    positionAttr.setUsage(THREE.DynamicDrawUsage) // updated on the CPU while morphing
    colorAttr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', positionAttr)
    geometry.setAttribute('aColor', colorAttr)
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(random, 1))
    // Particles move around, so use a generous fixed bounding sphere
    // instead of recomputing it every frame.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)

    if (this.points) {
      this.points.geometry.dispose()
      this.points.geometry = geometry
    } else {
      this.points = new THREE.Points(geometry, this.material)
      this.spin.add(this.points)
    }

    this.buffers = { positions, colors, speeds, targets: null, targetColors: null }
    this.random = random
    this.jitter = jitter
    this.velocities = new Float32Array(count * 3)
    this.positionAttr = positionAttr
    this.colorAttr = colorAttr
    this.burstTime = 0
    // Particle opacity. With normal blending, density no longer brightens
    // the image, so this stays constant regardless of particle count.
    this.material.uniforms.uIntensity.value = 0.85
    this.applyFormationTargets()
  }

  getFormation(id, count) {
    const key = `${id}:${count}`
    if (!this.formationCache.has(key)) {
      const { generate, palette } = FORMATIONS[id]
      const { positions, mix } = generate(count)
      this.formationCache.set(key, { positions, colors: colorize(mix, palette.stops, mulberry32(11)) })
    }
    return this.formationCache.get(key)
  }

  applyFormationTargets() {
    const shape = this.getFormation(this.formationId, this.count)
    this.buffers.targets = shape.positions
    this.buffers.targetColors = shape.colors
    this.settled = false
  }

  /** Smoothly morph to a named formation (see FORMATIONS). */
  setFormation(id) {
    if (!FORMATIONS[id] || id === this.formationId) return
    this.formationId = id
    this.applyFormationTargets()
    this.onFormationChange?.(id)
  }

  /**
   * Where the hand wants the formation to be. Pass null when no hand is
   * visible and the formation drifts back to the centre.
   * @param {{x:number, y:number, roll:number, scale:number} | null} target
   */
  setHandTarget(target) {
    this.handTarget = target ? { ...NO_HAND, ...target } : { ...NO_HAND }
  }

  /** Big Bang: fling every particle outward, then let it reform as `nextId`. */
  explode(nextId = 'galaxy') {
    this.setFormation(nextId)
    const { positions } = this.buffers
    const v = this.velocities
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      const x = positions[i3] + this.jitter[i3] * 0.4
      const y = positions[i3 + 1] + this.jitter[i3 + 1] * 0.4
      const z = positions[i3 + 2] + this.jitter[i3 + 2] * 0.4
      const speed = (2.5 + this.random[i] * 5) / (Math.hypot(x, y, z) || 1)
      v[i3] = x * speed
      v[i3 + 1] = y * speed
      v[i3 + 2] = z * speed
    }
    this.burstTime = BURST_DURATION
    this.settled = false
  }

  /** Back to the starting state (used by the Reset button). */
  reset() {
    this.burstTime = 0
    this.setHandTarget(null)
    this.setFormation('sphere')
  }

  /** Update any subset of settings; only the affected parts are touched. */
  setSettings(partial) {
    const prev = this.settings
    this.settings = { ...prev, ...partial }
    const s = this.settings
    const u = this.material.uniforms

    if (s.count !== prev.count) {
      // A new maximum chosen by the user: start from it and adapt again.
      this.count = s.count
      this.countCeiling = Infinity
      this.fpsHistory = []
      this.buildParticles(this.count)
    }
    if (s.background !== prev.background) this.renderer.setClearColor(s.background, 1)
    u.uSize.value = s.size
    u.uGlow.value = s.glow
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // On narrow (portrait) screens pull the camera back so shapes still fit.
    this.camera.position.z = w / h < 1 ? 6 / Math.max(w / h, 0.55) : 6
    this.camera.updateProjectionMatrix()
  }

  animate(timestamp) {
    this.rafId = requestAnimationFrame(this.animate)
    this.timer.update(timestamp)
    // Clamp dt so a stalled frame can't teleport particles.
    const realDt = Math.min(this.timer.getDelta(), 0.1)
    const dt = realDt * this.settings.speed
    this.elapsed += dt
    const u = this.material.uniforms

    let lambda = MORPH_LAMBDA
    if (this.burstTime > 0) {
      // Big Bang physics: fly outward with drag, while the pull back toward
      // the new formation grows from 0 to full strength.
      this.burstTime = Math.max(0, this.burstTime - realDt)
      const progress = 1 - this.burstTime / BURST_DURATION
      lambda *= progress * progress
      const drag = Math.exp(-2.4 * dt)
      const { positions } = this.buffers
      const v = this.velocities
      for (let i = 0; i < v.length; i++) {
        positions[i] += v[i] * dt
        v[i] *= drag
      }
      u.uBurst.value = (1 - progress) ** 3
      this.settled = false
    } else {
      u.uBurst.value = 0
    }

    if (!this.settled) {
      const remaining = stepMorph(this.buffers, lambda, dt)
      this.positionAttr.needsUpdate = true
      this.colorAttr.needsUpdate = true
      // Stop uploading to the GPU once every particle has arrived.
      if (remaining < 0.0005 && this.burstTime === 0) this.settled = true
    }

    // Per-formation idle animations (in the shader), eased in/out so the
    // old one fades while the new one grows during a morph.
    const ease = dampFactor(2.5, realDt)
    for (const [id, name] of Object.entries(WEIGHT_UNIFORMS)) {
      this.weights[id] += ((id === this.formationId ? 1 : 0) - this.weights[id]) * ease
      u[name].value = this.weights[id]
    }
    this.sparkle += (FORMATIONS[this.formationId].palette.sparkle - this.sparkle) * ease
    u.uSparkle.value = this.sparkle
    // Heartbeat: a "lub-dub" double pulse about 70 times a minute.
    const phase = (this.elapsed * 1.15) % 1
    u.uPulse.value = Math.exp(-(((phase - 0.1) / 0.05) ** 2)) + 0.6 * Math.exp(-(((phase - 0.3) / 0.06) ** 2))

    // Ease the formation toward the hand. Uses real time (not the speed
    // setting) so hand control always feels equally responsive.
    const f = dampFactor(HAND_LAMBDA, realDt)
    const target = this.handTarget
    const g = this.group
    g.position.x += (target.x - g.position.x) * f
    g.position.y += (target.y - g.position.y) * f
    g.rotation.z += (target.roll - g.rotation.z) * f
    g.scale.setScalar(g.scale.x + (target.scale - g.scale.x) * f)

    this.spin.rotation.y += IDLE_SPIN * dt
    u.uTime.value = this.elapsed
    this.renderer.render(this.scene, this.camera)

    this.frames++
    const now = performance.now()
    if (now - this.statsTime >= 500) {
      const fps = (this.frames * 1000) / (now - this.statsTime)
      this.frames = 0
      this.statsTime = now
      this.adaptDensity(fps, now)
      this.onStats?.({ fps, particles: this.count })
    }
  }

  /**
   * Adaptive density: if the frame rate stays low for ~2 s, use 20% fewer
   * particles; if it stays high, slowly add them back (never above the
   * user's chosen maximum, nor above a count that was already too slow).
   */
  adaptDensity(fps, now) {
    if (document.hidden) return
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > ADAPT.windows) this.fpsHistory.shift()
    if (!this.settings.adaptive || this.fpsHistory.length < ADAPT.windows || now - this.lastAdapt < ADAPT.cooldownMs) return
    const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
    let next = this.count
    if (avg < ADAPT.lowFps && this.count > ADAPT.min) {
      this.countCeiling = this.count - 1
      this.growBlockedUntil = now + ADAPT.growBlockMs
      next = Math.max(ADAPT.min, Math.round((this.count * ADAPT.step) / 500) * 500)
    } else if (avg > ADAPT.highFps && now > this.growBlockedUntil) {
      next = Math.min(this.settings.count, this.countCeiling, Math.round((this.count * ADAPT.grow) / 500) * 500)
    }
    if (next !== this.count && next > 0) {
      this.count = next
      this.lastAdapt = now
      this.fpsHistory = []
      this.buildParticles(next)
    }
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.timer.dispose()
    this.points.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.formationCache.clear()
  }
}
