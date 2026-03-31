import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderWaveTunnel(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.74 : 1.08),
  );
  const energyBoost = p.isFirefox ? 1.08 : 1.18;
  const ringCount = Math.max(
    10,
    Math.min(24, (12 + detailScale * 8 + bassIntensity * 10) | 0),
  );
  const segments = Math.max(
    22,
    Math.min(48, (26 + detailScale * 18 - bassIntensity * 4) | 0),
  );
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.46;
  const travel = p.time * 0.0013 * (1 + bassIntensity * 1.8);
  const accentStride = p.isFirefox ? 3 : 2;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = p.hsla(
    p.fastMod360(p.hueBase + 198),
    100,
    56,
    0.06 + audioIntensity * 0.08,
  );
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius * (0.18 + bassIntensity * 0.08), 0, p.TWO_PI);
  ctx.fill();

  for (let ring = 0; ring < ringCount; ring++) {
    const depth = (((ring / ringCount + travel) % 1) + 1) % 1;
    const radius = maxRadius * (0.12 + depth * depth);
    const alpha = clamp(
      (1 - depth) * (0.15 + audioIntensity * 0.22) * energyBoost,
      0.1,
      0.52,
    );
    const hue = p.fastMod360(p.hueBase + 190 + depth * 180 + ring * 8);
    const lineWidth =
      1.3 + trebleIntensity * 1.4 + (1 - depth) * 2.2 + bassIntensity * 0.6;

    ctx.strokeStyle = p.hsla(hue, 100, 70 + (1 - depth) * 10, alpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * p.TWO_PI;
      const warp =
        p.fastSin(angle * 3 + travel * 10 + ring * 0.6) *
          radius *
          (0.1 + bassIntensity * 0.14) +
        p.fastCos(angle * 7 - travel * 6) *
          radius *
          (0.03 + trebleIntensity * 0.012);
      const x = p.fastCos(angle) * (radius + warp);
      const y = p.fastSin(angle) * (radius + warp);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();

    if (ring % accentStride === 0 && depth < 0.84) {
      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 54),
        100,
        86,
        clamp(alpha * 0.78, 0.08, 0.36),
      );
      ctx.lineWidth = Math.max(0.8, lineWidth * 0.38);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = p.hsla(
    p.fastMod360(p.hueBase + 228),
    100,
    84,
    0.18 + audioIntensity * 0.16,
  );
  ctx.lineWidth = 1.4 + trebleIntensity * 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius * (0.08 + bassIntensity * 0.05), 0, p.TWO_PI);
  ctx.stroke();

  ctx.restore();
}
