import type { FlowFieldPatternContext } from "./types";

export interface LensMass {
  x: number;
  y: number;
  mass: number;
}

interface FieldVector {
  x: number;
  y: number;
}

const lensScratch: FieldVector = { x: 0, y: 0 };

export function sampleLensDeflection(
  x: number,
  y: number,
  lenses: readonly LensMass[],
  softening: number,
  target: FieldVector = { x: 0, y: 0 },
): FieldVector {
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < lenses.length; i++) {
    const lens = lenses[i];
    if (!lens) continue;

    const dx = x - lens.x;
    const dy = y - lens.y;
    const distanceSq = dx * dx + dy * dy + softening;
    const weight = lens.mass / (distanceSq * Math.sqrt(distanceSq));
    sumX += dx * weight;
    sumY += dy * weight;
  }

  target.x = sumX;
  target.y = sumY;
  return target;
}

export function renderGravitationalLensArray(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.7 : 1.02),
  );
  const minDimension = Math.min(p.width, p.height);
  const time = p.time * 0.0011;
  const streamCount = Math.max(
    12,
    Math.min(22, Math.round(12 + detailScale * 7 + bassIntensity * 4)),
  );
  const segments = Math.max(
    28,
    Math.min(64, Math.round(32 + detailScale * 20 + trebleIntensity * 7)),
  );
  const warpScale = minDimension * (0.18 + bassIntensity * 0.06);
  const verticalJitter = p.height * (0.012 + trebleIntensity * 0.018);
  const lenses: LensMass[] = [
    {
      x: p.centerX + p.fastCos(time * 0.7) * minDimension * 0.16,
      y: p.centerY + p.fastSin(time * 0.9) * minDimension * 0.12,
      mass: 1.8 + bassIntensity * 1.4,
    },
    {
      x: p.centerX - minDimension * 0.22 + p.fastSin(time * 0.55) * 26,
      y: p.centerY - minDimension * 0.15 + p.fastCos(time * 0.82) * 20,
      mass: 1.1 + audioIntensity * 0.7,
    },
    {
      x: p.centerX + minDimension * 0.24 + p.fastCos(time * 0.61) * 24,
      y: p.centerY + minDimension * 0.18 + p.fastSin(time * 0.74) * 22,
      mass: 1.05 + trebleIntensity * 0.8,
    },
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let row = 0; row < streamCount; row++) {
    const rowProgress = streamCount === 1 ? 0.5 : row / (streamCount - 1);
    const baseY = p.height * (0.08 + rowProgress * 0.84);
    const hue = p.fastMod360(p.hueBase + 196 + row * 7 + time * 34);

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      70 + (row % 4) * 2,
      0.05 + audioIntensity * 0.09,
    );
    ctx.lineWidth = 0.9 + (row % 3) * 0.35 + trebleIntensity * 0.9;
    ctx.beginPath();

    for (let step = 0; step <= segments; step++) {
      const progress = step / segments;
      const x = progress * p.width;
      const y =
        baseY +
        p.fastSin(time * 2.2 + row * 0.41 + progress * p.TWO_PI) *
          verticalJitter;
      sampleLensDeflection(x, y, lenses, 320, lensScratch);

      const px = x + lensScratch.x * warpScale;
      const py =
        y +
        lensScratch.y * warpScale * 0.72 +
        p.fastCos(progress * 18 + time * 1.9 + row) * verticalJitter * 0.2;

      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  const columnCount = Math.max(8, Math.min(14, Math.round(7 + detailScale * 5)));
  for (let column = 0; column < columnCount; column++) {
    const columnProgress =
      columnCount === 1 ? 0.5 : column / (columnCount - 1);
    const baseX = p.width * (0.1 + columnProgress * 0.8);
    const hue = p.fastMod360(p.hueBase + 232 + column * 11 + time * 26);

    ctx.strokeStyle = p.hsla(hue, 100, 66, 0.035 + audioIntensity * 0.06);
    ctx.lineWidth = 0.8 + bassIntensity * 0.8;
    ctx.beginPath();

    for (let step = 0; step <= segments; step++) {
      const progress = step / segments;
      const y = progress * p.height;
      const x =
        baseX +
        p.fastCos(time * 1.6 + column * 0.48 + progress * p.TWO_PI) *
          p.width *
          0.006 *
          (1 + trebleIntensity);
      sampleLensDeflection(x, y, lenses, 320, lensScratch);

      const px = x + lensScratch.x * warpScale * 0.8;
      const py = y + lensScratch.y * warpScale * 0.56;

      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  for (let i = 0; i < lenses.length; i++) {
    const lens = lenses[i];
    if (!lens) continue;

    const ringRadius = minDimension * (0.045 + lens.mass * 0.015);
    const glow = ctx.createRadialGradient(
      lens.x,
      lens.y,
      0,
      lens.x,
      lens.y,
      ringRadius * 2.4,
    );
    glow.addColorStop(
      0,
      p.hsla(p.fastMod360(p.hueBase + 48 + i * 44), 100, 90, 0.24),
    );
    glow.addColorStop(
      1,
      p.hsla(p.fastMod360(p.hueBase + 210 + i * 32), 100, 40, 0),
    );
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lens.x, lens.y, ringRadius * 2.4, 0, p.TWO_PI);
    ctx.fill();

    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + 30 + i * 52),
      100,
      78,
      0.12 + audioIntensity * 0.1,
    );
    ctx.lineWidth = 1.4 + trebleIntensity * 1.2;
    ctx.beginPath();
    ctx.arc(lens.x, lens.y, ringRadius, 0, p.TWO_PI);
    ctx.stroke();
  }

  ctx.restore();
}
