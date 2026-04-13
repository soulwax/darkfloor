import type { FlowFieldPatternContext } from "./types";

interface AbyssState {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  phase: Float32Array;
  depth: Float32Array;
  width: number;
  height: number;
  count: number;
}

let abyssState: AbyssState | null = null;

function createAbyssState(
  count: number,
  width: number,
  height: number,
): AbyssState {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const phase = new Float32Array(count);
  const depth = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    depth[i] = Math.random();
    phase[i] = Math.random() * Math.PI * 2;
    x[i] = Math.random() * width;
    y[i] = Math.random() * height;
    vx[i] = (Math.random() - 0.5) * 0.18;
    vy[i] = -(0.06 + depth[i] * 0.22);
  }

  return {
    x,
    y,
    vx,
    vy,
    phase,
    depth,
    width,
    height,
    count,
  };
}

function ensureAbyssState(
  count: number,
  width: number,
  height: number,
): AbyssState {
  if (
    abyssState &&
    abyssState.count === count &&
    abyssState.width === width &&
    abyssState.height === height
  ) {
    return abyssState;
  }

  abyssState = createAbyssState(count, width, height);
  return abyssState;
}

function reseedAbyssPoint(
  state: AbyssState,
  index: number,
  width: number,
  height: number,
): void {
  const depth = Math.random();
  state.depth[index] = depth;
  state.phase[index] = Math.random() * Math.PI * 2;
  state.x[index] = Math.random() * width;
  state.y[index] = height + depth * 40;
  state.vx[index] = (Math.random() - 0.5) * 0.14;
  state.vy[index] = -(0.06 + depth * 0.22);
}

export function renderBioluminescentAbyss(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.68,
    p.detailScale * (p.isFirefox ? 0.66 : 0.98),
  );
  const count = Math.max(
    60,
    Math.min(168, Math.round(72 + detailScale * 56 + bassIntensity * 34)),
  );
  const state = ensureAbyssState(count, p.width, p.height);
  const time = p.time * 0.0012;
  const minDimension = Math.min(p.width, p.height);
  const pulseCount = p.isFirefox ? 2 : 3;
  const glowStride = p.isFirefox ? 6 : 4;
  const pad = 32;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let pulse = 0; pulse < pulseCount; pulse++) {
    const progress = (((time * 0.095 + pulse / pulseCount) % 1) + 1) % 1;
    const radius = minDimension * (0.1 + progress * 0.5);
    const alpha = (1 - progress) * (0.08 + bassIntensity * 0.08);
    const hue = p.fastMod360(p.hueBase + 168 + pulse * 34 + progress * 92);

    ctx.strokeStyle = p.hsla(hue, 92, 62, alpha);
    ctx.lineWidth = 1 + (1 - progress) * (2.2 + bassIntensity * 1.4);
    ctx.beginPath();
    ctx.arc(p.centerX, p.height * (0.8 - pulse * 0.06), radius, 0, p.TWO_PI);
    ctx.stroke();
  }

  for (let i = 0; i < count; i++) {
    const depth = state.depth[i] ?? 0;
    const phase = state.phase[i] ?? 0;
    const sway =
      p.fastSin(time * 2.4 + phase + (state.y[i] ?? 0) * 0.011) *
      (0.028 + trebleIntensity * 0.05);
    const eddy =
      p.fastCos(time * 1.6 + phase * 1.7 + (state.x[i] ?? 0) * 0.009) *
      (0.01 + audioIntensity * 0.018);
    const drift = 0.055 + depth * 0.18 + bassIntensity * 0.12;

    let vx = ((state.vx[i] ?? 0) + sway) * 0.986;
    let vy =
      ((state.vy[i] ?? 0) - drift * 0.014 + eddy) *
      (0.992 + depth * 0.003);

    state.x[i] = (state.x[i] ?? 0) + vx;
    state.y[i] = (state.y[i] ?? 0) + vy;
    state.vx[i] = vx;
    state.vy[i] = vy;

    if ((state.x[i] ?? 0) < -pad) state.x[i] = p.width + pad;
    if ((state.x[i] ?? 0) > p.width + pad) state.x[i] = -pad;
    if ((state.y[i] ?? 0) < -pad) {
      reseedAbyssPoint(state, i, p.width, p.height);
      continue;
    }

    const x = state.x[i] ?? 0;
    const y = state.y[i] ?? 0;
    const hue = p.fastMod360(
      p.hueBase + 154 + depth * 88 + p.fastSin(time + phase) * 26,
    );
    const tendrilLength = 8 + depth * 18 + trebleIntensity * 8;
    const nodeSize = 1 + depth * 2 + audioIntensity * 1.9;

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      68 + depth * 12,
      0.04 + depth * 0.1 + audioIntensity * 0.04,
    );
    ctx.lineWidth = 0.6 + depth * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let segment = 1; segment <= 3; segment++) {
      const swayOffset =
        p.fastSin(time * 3.1 + phase + segment * 0.9) *
        tendrilLength *
        (0.22 - segment * 0.04);
      ctx.lineTo(x + swayOffset, y + segment * tendrilLength * 0.34);
    }
    ctx.stroke();

    ctx.fillStyle = p.hsla(
      hue,
      100,
      78 + depth * 10,
      0.14 + depth * 0.18 + audioIntensity * 0.16,
    );
    ctx.fillRect(
      x - nodeSize * 0.5,
      y - nodeSize * 0.5,
      nodeSize,
      nodeSize,
    );

    if (i % glowStride === 0 && depth > 0.5) {
      ctx.fillStyle = p.hsla(
        hue + 28,
        100,
        82,
        0.05 + depth * 0.1 + audioIntensity * 0.08,
      );
      ctx.beginPath();
      ctx.arc(x, y, nodeSize * (1.4 + depth), 0, p.TWO_PI);
      ctx.fill();
    }
  }

  ctx.restore();
}
