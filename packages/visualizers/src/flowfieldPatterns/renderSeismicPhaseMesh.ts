import type { FlowFieldPatternContext } from "./types";

export interface Epicenter {
  x: number;
  y: number;
  amplitude: number;
  frequency: number;
  decay: number;
  phase: number;
}

export function sampleSeismicField(
  x: number,
  y: number,
  epicenters: readonly Epicenter[],
  time: number,
): number {
  let field = 0;

  for (let i = 0; i < epicenters.length; i++) {
    const epicenter = epicenters[i];
    if (!epicenter) continue;

    const dx = x - epicenter.x;
    const dy = y - epicenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy) + 1;
    const envelope = 1 / (1 + distance * epicenter.decay);
    field +=
      Math.sin(distance * epicenter.frequency - time + epicenter.phase) *
      envelope *
      epicenter.amplitude;
  }

  return field;
}

export function renderSeismicPhaseMesh(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  midIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.68 : 1),
  );
  const minDimension = Math.min(p.width, p.height);
  const rows = Math.max(
    10,
    Math.min(20, Math.round(10 + detailScale * 6 + bassIntensity * 4)),
  );
  const cols = Math.max(
    18,
    Math.min(40, Math.round(20 + detailScale * 14 + midIntensity * 8)),
  );
  const verticals = Math.max(
    8,
    Math.min(18, Math.round(8 + detailScale * 6 + audioIntensity * 4)),
  );
  const amplitudeScale = minDimension * (0.025 + bassIntensity * 0.03);
  const time = p.time * 0.06;
  const epicenters: Epicenter[] = [
    {
      x: p.width * 0.26 + p.fastSin(p.time * 0.0011) * 32,
      y: p.height * 0.34 + p.fastCos(p.time * 0.0015) * 28,
      amplitude: 1.2 + bassIntensity * 0.6,
      frequency: 0.075,
      decay: 0.012,
      phase: 0,
    },
    {
      x: p.width * 0.68 + p.fastCos(p.time * 0.0009) * 34,
      y: p.height * 0.58 + p.fastSin(p.time * 0.0013) * 26,
      amplitude: 0.95 + midIntensity * 0.55,
      frequency: 0.083,
      decay: 0.011,
      phase: Math.PI * 0.55,
    },
    {
      x: p.width * 0.48 + p.fastSin(p.time * 0.0014) * 18,
      y: p.height * 0.74 + p.fastCos(p.time * 0.0008) * 24,
      amplitude: 0.8 + audioIntensity * 0.45,
      frequency: 0.071,
      decay: 0.014,
      phase: Math.PI * 1.1,
    },
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let row = 0; row < rows; row++) {
    const rowProgress = rows === 1 ? 0.5 : row / (rows - 1);
    const baseY = p.height * (0.08 + rowProgress * 0.84);
    const hue = p.fastMod360(p.hueBase + 142 + row * 9 + time * 0.6);

    ctx.strokeStyle = p.hsla(
      hue,
      96,
      64 + (row % 3) * 3,
      0.05 + audioIntensity * 0.08,
    );
    ctx.lineWidth = 0.95 + (row % 4) * 0.28 + midIntensity * 0.8;
    ctx.beginPath();

    for (let col = 0; col <= cols; col++) {
      const progress = col / cols;
      const x = p.width * (0.06 + progress * 0.88);
      const field = sampleSeismicField(x, baseY, epicenters, time);
      const y =
        baseY +
        field * amplitudeScale +
        p.fastSin(progress * p.TWO_PI * 2 + row * 0.28) *
          amplitudeScale *
          0.12;

      if (col === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  for (let column = 0; column < verticals; column++) {
    const progress = verticals === 1 ? 0.5 : column / (verticals - 1);
    const baseX = p.width * (0.08 + progress * 0.84);
    const hue = p.fastMod360(p.hueBase + 218 + column * 11 + time * 0.45);

    ctx.strokeStyle = p.hsla(hue, 100, 68, 0.035 + audioIntensity * 0.05);
    ctx.lineWidth = 0.7 + bassIntensity * 0.7;
    ctx.beginPath();

    for (let row = 0; row <= rows; row++) {
      const rowProgress = row / rows;
      const y = p.height * (0.08 + rowProgress * 0.84);
      const field = sampleSeismicField(baseX, y, epicenters, time);
      const x = baseX + field * amplitudeScale * 0.7;

      if (row === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  for (let i = 0; i < epicenters.length; i++) {
    const epicenter = epicenters[i];
    if (!epicenter) continue;

    const ringCount = p.isFirefox ? 2 : 3;
    for (let ring = 0; ring < ringCount; ring++) {
      const progress = (((time * 0.013 + i * 0.19 + ring * 0.23) % 1) + 1) % 1;
      const radius = minDimension * (0.03 + progress * 0.24);
      const alpha = (1 - progress) * (0.12 + bassIntensity * 0.08);
      ctx.strokeStyle = p.hsla(
        p.fastMod360(p.hueBase + 120 + i * 38 + ring * 14),
        100,
        74,
        alpha,
      );
      ctx.lineWidth = 1 + (1 - progress) * (2 + midIntensity);
      ctx.beginPath();
      ctx.arc(epicenter.x, epicenter.y, radius, 0, p.TWO_PI);
      ctx.stroke();
    }
  }

  ctx.restore();
}
