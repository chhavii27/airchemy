/**
 * GLSL for the particle material.
 *
 * Vertex shader:
 *  - Each formation has an idle animation, weighted by uW<Formation>
 *    (0..1, eased by the engine). During a morph the old animation fades out
 *    while the new one fades in, so motion never jumps.
 *  - Organic floating drift, depth-scaled point size, twinkle and glitter.
 * Fragment shader:
 *  - Each point is a soft round particle in its own palette colour.
 *  - Normal (alpha) blending: overlapping particles layer like paint
 *    instead of adding light, so dense areas show the true, rich colour
 *    and never wash out to white. The soft alpha edge keeps a gentle glow.
 */
import { SATURN_TILT, SATURN_LEAN, GALAXY_TILT } from '../utils/particleShapes.js'

// Format a JS number as a GLSL float literal, parenthesised so negatives are safe.
const f = (n) => `(${n.toFixed(5)})`

export const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uFloat;
  uniform float uSparkle;
  uniform float uPulse;

  uniform float uWSphere;
  uniform float uWButterfly;
  uniform float uWLotus;
  uniform float uWSaturn;
  uniform float uWGalaxy;
  uniform float uWHeart;

  attribute float aRandom;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vFlash;

  vec2 rot(vec2 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  void main() {
    vec3 p = position;
    float r2 = fract(aRandom * 13.731); // second independent random per particle
    float alpha = 1.0;
    float extra = 0.0; // extra brightness (electric crackle)

    // 1. Electric Plasma: surface waves push particles in and out, and
    //    random particles crackle with brief flashes.
    if (uWSphere > 0.001) {
      float wave = sin(p.x * 4.0 + uTime * 1.7) * sin(p.y * 4.0 - uTime * 1.3) * sin(p.z * 4.0 + uTime * 1.1);
      p += normalize(p + 1e-4) * wave * 0.04 * uWSphere;
      float crackle = step(0.965, fract(sin(floor(uTime * 14.0) * 12.9898 + aRandom * 78.233) * 43758.5453));
      extra += crackle * 0.5 * uWSphere;
    }

    // 2. Mystic Wings: each wing rotates around the body, plus a gentle bob.
    if (uWButterfly > 0.001) {
      float wing = sin(uTime * 5.0) * 0.6 * uWButterfly;
      float ax = abs(p.x);
      p.x = sign(p.x) * ax * cos(wing);
      p.z += ax * sin(wing);
      p.y += sin(uTime * 2.5) * 0.06 * uWButterfly;
    }

    // 3. Divine Blossom: petals breathe open and closed; a few particles
    //    lift off as glowing pollen and fade out as they rise.
    if (uWLotus > 0.001) {
      float h = clamp((p.y + 0.45) / 1.4, 0.0, 1.0);
      p.xz *= 1.0 + sin(uTime * 0.9) * 0.06 * h * uWLotus;
      if (aRandom > 0.965) {
        float rise = fract(uTime * 0.08 + r2 * 7.0);
        p.y += rise * 1.6 * uWLotus;
        p.xz *= 1.0 + rise * 0.35 * uWLotus;
        alpha *= mix(1.0, sin(rise * 3.14159), uWLotus);
      }
    }

    // 4. Golden Orbit: undo Saturn's lean and ring tilt, rotate in the ring
    //    plane (outer rings slower, like real orbits), then re-apply them.
    if (uWSaturn > 0.001) {
      vec3 q = p;
      q.xy = rot(q.xy, ${f(-SATURN_LEAN)});
      q.yz = rot(q.yz, ${f(-SATURN_TILT)});
      float r = length(q.xz);
      float speed = r > 1.05 ? 0.9 / pow(r, 1.5) : 0.18;
      q.xz = rot(q.xz, uTime * speed);
      q.yz = rot(q.yz, ${f(SATURN_TILT)});
      q.xy = rot(q.xy, ${f(SATURN_LEAN)});
      p = mix(p, q, uWSaturn);
    }

    // 5. Cosmic Infinity: the disc turns, inner regions swaying slightly
    //    faster (kept small so the arms never wind up).
    if (uWGalaxy > 0.001) {
      vec3 q = p;
      q.yz = rot(q.yz, ${f(-GALAXY_TILT)});
      float r = length(q.xz);
      q.xz = rot(q.xz, -(uTime * 0.08 + sin(uTime * 0.35) * 0.25 / (r + 0.5)));
      q.yz = rot(q.yz, ${f(GALAXY_TILT)});
      p = mix(p, q, uWGalaxy);
    }

    // 6. Eternal Love: a lub-dub heartbeat, with embers drifting upward.
    if (uWHeart > 0.001) {
      p *= 1.0 + uPulse * 0.07 * uWHeart;
      if (aRandom > 0.965) {
        float rise = fract(uTime * 0.07 + r2 * 5.0);
        p.y += rise * 1.4 * uWHeart;
        p.x += sin(rise * 9.0 + r2 * 6.0) * 0.12 * uWHeart;
        alpha *= mix(1.0, sin(rise * 3.14159), uWHeart);
      }
    }

    // Organic drift: each particle follows its own phase-shifted sine loop.
    float t = uTime * 0.6 + aRandom * 6.2831;
    p += vec3(sin(t * 1.3), cos(t * 1.1), sin(t * 0.9 + 1.7)) * uFloat * (0.4 + aRandom * 0.6);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + aRandom * 40.0);
    // Glitter: short, sharp flashes; each particle has its own rhythm.
    float flash = pow(max(0.0, sin(uTime * (1.5 + r2 * 3.0) + aRandom * 90.0)), 24.0) * uSparkle;

    // Fine, even particles (a few slightly larger) keep outlines crisp.
    float sizeVariation = 0.7 + pow(r2, 6.0) * 0.9;
    gl_PointSize = uSize * uPixelRatio * sizeVariation * (twinkle + flash) * (10.0 / -mvPosition.z);

    vColor = aColor;
    vAlpha = min(twinkle + extra, 1.6) * alpha;
    vFlash = flash + extra;
  }
`

export const particleFragmentShader = /* glsl */ `
  uniform float uGlow;
  uniform float uIntensity;
  uniform float uBurst; // 0..1 flash during a Big Bang

  varying vec3 vColor;
  varying float vAlpha;
  varying float vFlash;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 at centre, 1 at edge
    if (d > 1.0) discard;

    // Soft round particle: solid colour, alpha fading toward the edge.
    float glow = exp(-d * d * 5.0);
    float core = exp(-d * d * 30.0);
    vec3 color = vColor * (1.0 + core * 0.15);
    color += vFlash * core * vColor * 0.6; // glints in the shape's own colour
    color = mix(color, vec3(1.0), uBurst * 0.4);

    float a = min(1.0, glow * vAlpha * uIntensity * uGlow * (1.0 + uBurst));
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
  }
`
