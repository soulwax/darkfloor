import type { FlowFieldPatternContext } from "./types";

interface ChladniState {
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  phase: Float32Array;
  width: number;
  height: number;
  count: number;
}

let chladniState: ChladniState | null = null;

function createChladniState(
  count: number,
  width: number,
  height: number,
): ChladniState {
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const phase = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    px[i] = Math.random() * width;
    py[i] = Math.random() * height;
    vx[i] = (Math.random() - 0.5) * 0.8;
    vy[i] = (Math.random() - 0.5) * 0.8;
    phase[i] = Math.random() * Math.PI * 2;
  }

  return {
    px,
    py,
    vx,
    vy,
    phase,
    width,
    height,
    count,
  };
}

function ensureChladniState(
  count: number,
  width: number,
  height: number,
): ChladniState {
  if (
    chladniState &&
    chladniState.count === count &&
    chladniState.width === width &&
    chladniState.height === height
  ) {
    return chladniState;
  }

  chladniState = createChladniState(count, width, height);
  return chladniState;
}

function respawnChladniParticle(
  state: ChladniState,
  index: number,
  width: number,
  height: number,
): void {
  state.px[index] = Math.random() * width;
  state.py[index] = Math.random() * height;
  state.vx[index] = (Math.random() - 0.5) * 0.6;
  state.vy[index] = (Math.random() - 0.5) * 0.6;
  state.phase[index] = Math.random() * Math.PI * 2;
}

export function chladniF(
  x: number,
  y: number,
  m: number,
  n: number,
  width: number,
  height: number,
): number {
  const nx = (x / width) * Math.PI;
  const ny = (y / height) * Math.PI;

  return (
    Math.cos(m * nx) * Math.cos(n * ny) -
    Math.cos(n * nx) * Math.cos(m * ny)
  );
}

export function renderChladniResonance(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.7,
    p.detailScale * (p.isFirefox ? 0.68 : 1.02),
  );
  const count = Math.max(
    420,
    Math.min(1480, Math.round(560 + detailScale * 520 + bassIntensity * 260)),
  );
  const state = ensureChladniState(count, p.width, p.height);
  const time = p.time * 0.0011;
  const m = 2 + Math.round((p.fastSin(time * 0.37) * 0.5 + 0.5) * 4);
  let n = 3 + Math.round((p.fastCos(time * 0.29 + 0.8) * 0.5 + 0.5) * 4);
  if (n === m) {
    n = n >= 7 ? 3 : n + 1;
  }
  const force = 0.58 + bassIntensity * 1.45;
  const swirl = 0.013 + trebleIntensity * 0.036;
  const damping = 0.92 - Math.min(0.04, audioIntensity * 0.03);
  const maxSpeed = 1.25 + audioIntensity * 1.85 + trebleIntensity * 0.9;
  const pad = 12;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i++) {
    const x = state.px[i] ?? 0;
    const y = state.py[i] ?? 0;
    const phase = state.phase[i] ?? 0;
    const nx = (x / p.width) * Math.PI;
    const ny = (y / p.height) * Math.PI;
    const mNx = m * nx;
    const nNx = n * nx;
    const mNy = m * ny;
    const nNy = n * ny;

    const field =
      (p.fastCos(mNx) * p.fastCos(nNy) -
        p.fastCos(nNx) * p.fastCos(mNy)) *
      (1 + p.fastSin(time * 0.9 + phase) * 0.08);

    const gradX =
      (-Math.PI / p.width) *
      (m * p.fastSin(mNx) * p.fastCos(nNy) -
        n * p.fastSin(nNx) * p.fastCos(mNy));
    const gradY =
      (-Math.PI / p.height) *
      (n * p.fastCos(mNx) * p.fastSin(nNy) -
        m * p.fastCos(nNx) * p.fastSin(mNy));

    let vx =
      ((state.vx[i] ?? 0) - gradX * field * force * 12) * damping +
      p.fastSin(time * 2.3 + phase + y * 0.011) * swirl;
    let vy =
      ((state.vy[i] ?? 0) - gradY * field * force * 12) * damping +
      p.fastCos(time * 1.8 - phase + x * 0.01) * swirl;

    const speed = p.fastSqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      const clamp = maxSpeed / Math.max(speed, 0.0001);
      vx *= clamp;
      vy *= clamp;
    }

    const nextX = x + vx;
    const nextY = y + vy;

    state.vx[i] = vx;
    state.vy[i] = vy;
    state.px[i] = nextX;
    state.py[i] = nextY;

    if (
      nextX < -pad ||
      nextX > p.width + pad ||
      nextY < -pad ||
      nextY > p.height + pad
    ) {
      respawnChladniParticle(state, i, p.width, p.height);
      continue;
    }

    const nodalGlow = Math.max(
      0,
      1 - Math.min(1, Math.abs(field) * (2.1 - bassIntensity * 0.45)),
    );
    const hue = p.fastMod360(
      p.hueBase + 188 + phase * 26 + field * 118 + nodalGlow * 54,
    );
    const alpha = 0.08 + nodalGlow * 0.24 + audioIntensity * 0.13;
    const size = 0.85 + nodalGlow * 1.9 + bassIntensity * 0.55;

    ctx.fillStyle = p.hsla(
      hue,
      92,
      58 + nodalGlow * 24,
      Math.min(0.78, alpha),
    );
    ctx.fillRect(nextX - size * 0.5, nextY - size * 0.5, size, size);

    if ((i & 15) === 0 && nodalGlow > 0.76) {
      ctx.strokeStyle = p.hsla(hue + 32, 100, 82, 0.08 + trebleIntensity * 0.1);
      ctx.lineWidth = 0.8 + nodalGlow * 0.9;
      ctx.beginPath();
      ctx.moveTo(nextX - size * 2.4, nextY);
      ctx.lineTo(nextX + size * 2.4, nextY);
      ctx.stroke();
    }
  }

  ctx.restore();
}
