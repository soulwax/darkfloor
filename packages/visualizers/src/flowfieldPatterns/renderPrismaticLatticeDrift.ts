import type { FlowFieldPatternContext } from "./types";

export function renderPrismaticLatticeDrift(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0016;
  const cols = Math.max(
    5,
    Math.min(p.isFirefox ? 9 : 13, Math.round(p.width / 95) + 2),
  );
  const rows = Math.max(
    4,
    Math.min(p.isFirefox ? 7 : 11, Math.round(p.height / 95) + 2),
  );
  const cell = Math.min(p.width / cols, p.height / rows) * 1.15;
  const skew = cell * 0.48;
  const drift = (bassIntensity * 14 + trebleIntensity * 10) * p.detailScale;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.rotate(t * 0.08);
  ctx.translate(-p.centerX, -p.centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let gy = -1; gy <= rows; gy++) {
    for (let gx = -1; gx <= cols; gx++) {
      const ox =
        p.centerX - (cols * cell) * 0.5 + gx * cell + p.fastSin(t + gx * 0.4) * drift;
      const oy =
        p.centerY - (rows * skew) * 0.5 + gy * skew + p.fastCos(t * 0.9 + gy * 0.5) * drift;

      const hue = p.fastMod360(
        p.hueBase + gx * 19 + gy * 31 + t * 50 + audioIntensity * 40,
      );

      ctx.fillStyle = p.hsla(hue, 96, 58, 0.09 + audioIntensity * 0.07);
      ctx.strokeStyle = p.hsla(p.fastMod360(hue + 70), 100, 72, 0.16 + trebleIntensity * 0.1);
      ctx.lineWidth = 1.1 + bassIntensity;

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + cell * 0.5, oy + skew * 0.5);
      ctx.lineTo(ox + cell, oy);
      ctx.lineTo(ox + cell * 0.5, oy - skew * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}
