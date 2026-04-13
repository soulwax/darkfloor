// File: packages/visualizers/src/flowfieldPatterns/renderChladniResonance.ts
import type { FlowFieldPatternContext } from "./types";

// Module-level particle state — same pattern as renderParticleSwarm.ts
let _px: Float32Array | null = null;
let _py: Float32Array | null = null;
let _vx: Float32Array | null = null;
let _vy: Float32Array | null = null;
let _stateW = 0;
let _stateH = 0;
let _stateN = 0;

function initParticles(n: number, w: number, h: number): void {
  _px = new Float32Array(n);
  _py = new Float32Array(n);
  _vx = new Float32Array(n);
  _vy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    _px[i] = Math.random() * w;
    _py[i] = Math.random() * h;
    _vx[i] = (Math.random() - 0.5) * 1.5;
    _vy[i] = (Math.random() - 0.5) * 1.5;
  }
  _stateW = w;
  _stateH = h;
  _stateN = n;
}

/**
 * Chladni standing-wave interference function.
 * Returns the wave amplitude at (x, y) for mode numbers (m, n).
 * Particles are pushed toward the zero-crossings (nodal lines).
 * Exported for unit testing.
 */
export function chladniF(
  x: number,
  y: number,
  m: number,
  n: number,
  w: number,
  h: number,
): number {
  const nx = (x / w) * Math.PI;
  const ny = (y / h) * Math.PI;
  return Math.cos(m * nx) * Math.cos(n * ny) - Math.cos(n * nx) * Math.cos(m * ny);
}

export function renderChladniResonance(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const w = p.width;
  const h = p.height;
  const n = p.isFirefox ? 700 : 1400;
  const phase = p.time * 0.0005;

  if (_px === null || _stateW !== w || _stateH !== h || _stateN !== n) {
    initParticles(n, w, h);
  }

  const px = _px!;
  const py = _py!;
  const vx = _vx!;
  const vy = _vy!;

  // Evolving mode numbers — slow drift creates pattern morphing
  const m = 2 + Math.floor((p.fastSin(phase * 0.23) * 0.5 + 0.5) * 2);
  const modeN = 3 + Math.floor((p.fastCos(phase * 0.17) * 0.5 + 0.5) * 2);

  // Slow fade for ghost trails
  ctx.fillStyle = p.hsla(0, 0, 2, 0.18);
  ctx.fillRect(0, 0, w, h);

  const eps = 0.8;
  const bassForce = 1.4 + bassIntensity * 1.2;
  const dt = 0.016;

  for (let i = 0; i < n; i++) {
    const v = chladniF(px[i], py[i], m, modeN, w, h);

    // Gradient of the Chladni function — steepest descent toward nodal lines
    const dfdx =
      (chladniF(px[i] + eps, py[i], m, modeN, w, h) -
       chladniF(px[i] - eps, py[i], m, modeN, w, h)) /
      (2 * eps);
    const dfdy =
      (chladniF(px[i], py[i] + eps, m, modeN, w, h) -
       chladniF(px[i], py[i] - eps, m, modeN, w, h)) /
      (2 * eps);

    // Restoring force toward nodal line; treble adds jitter
    vx[i] -= dfdx * v * bassForce * dt * 12;
    vy[i] -= dfdy * v * bassForce * dt * 12;
    if (trebleIntensity > 0.3) {
      vx[i] += (Math.random() - 0.5) * trebleIntensity * 0.6;
      vy[i] += (Math.random() - 0.5) * trebleIntensity * 0.6;
    }
    vx[i] *= 0.93;
    vy[i] *= 0.93;

    px[i] += vx[i];
    py[i] += vy[i];

    // Reflect off walls
    if (px[i] < 0) { px[i] = 0; vx[i] *= -0.5; }
    if (px[i] > w) { px[i] = w; vx[i] *= -0.5; }
    if (py[i] < 0) { py[i] = 0; vy[i] *= -0.5; }
    if (py[i] > h) { py[i] = h; vy[i] *= -0.5; }

    // Brightness inversely proportional to distance from nodal line
    const absV = Math.abs(v);
    const bright = Math.max(0, 1 - absV * 1.8);
    const hue = p.fastMod360(p.hueBase + 190 + absV * 120);
    const alpha = 0.55 + bright * 0.4 + audioIntensity * 0.1;
    ctx.fillStyle = p.hsla(hue, 90, 60 + bright * 30, alpha);
    const sz = 1.2 + bright * 1.8 * (1 + audioIntensity * 0.4);
    ctx.fillRect(px[i] - sz * 0.5, py[i] - sz * 0.5, sz, sz);
  }
}
