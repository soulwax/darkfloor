import type { FlowFieldPatternContext } from "./types";

export function renderWaveTunnel(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const ringCount = Math.max(10, (18 * (0.6 + p.fastSin(p.time * 0.0005) * 0.1 + 0.4)) | 0);
  const segments = Math.max(24, (44 - bassIntensity * 8) | 0);
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.46;
  const travel = p.time * 0.0013 * (1 + bassIntensity * 1.8);

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let ring = 0; ring < ringCount; ring++) {
    const depth = ((ring / ringCount + travel) % 1 + 1) % 1;
    const radius = maxRadius * (0.12 + depth * depth);
    const alpha = (1 - depth) * (0.12 + audioIntensity * 0.18);
    const hue = p.fastMod360(p.hueBase + 190 + depth * 180 + ring * 8);

    ctx.strokeStyle = p.hsla(hue, 94, 70, alpha);
    ctx.lineWidth = 1.1 + trebleIntensity * 1.2 + (1 - depth) * 1.4;
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * p.TWO_PI;
      const warp =
        p.fastSin(angle * 3 + travel * 10 + ring * 0.6) *
          radius *
          (0.08 + bassIntensity * 0.12) +
        p.fastCos(angle * 7 - travel * 6) * radius * 0.03;
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
  }

  ctx.restore();
}
