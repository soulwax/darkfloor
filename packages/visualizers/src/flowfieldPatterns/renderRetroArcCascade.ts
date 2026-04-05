import type { FlowFieldPatternContext } from "./types";

export function renderRetroArcCascade(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.002;
  const minDim = Math.min(p.width, p.height);
  const rMax = minDim * 0.5;
  const bands = p.isFirefox ? 5 : 8;
  const arcsPerBand = 4;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let b = 0; b < bands; b++) {
    const bandHue = p.fastMod360(
      p.hueBase + b * 36 + 300 + trebleIntensity * 25,
    );
    const baseR = rMax * (0.15 + (b / bands) * 0.78) + bassIntensity * 14;

    for (let q = 0; q < arcsPerBand; q++) {
      const start = (q / arcsPerBand) * p.TWO_PI * 0.5 + t * (0.4 + b * 0.05);
      const sweep = p.TWO_PI * 0.22 + audioIntensity * 0.35;
      const hue = p.fastMod360(bandHue + q * 22);

      const g = ctx.createRadialGradient(0, 0, baseR * 0.3, 0, 0, baseR);
      g.addColorStop(0, p.hsla(hue, 100, 72, 0.25 + audioIntensity * 0.15));
      g.addColorStop(1, p.hsla(p.fastMod360(hue + 60), 100, 48, 0));

      ctx.strokeStyle = g;
      ctx.lineWidth = 5 + trebleIntensity * 4 + (bands - b) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, baseR + q * 6 + p.fastSin(t + b) * 8, start, start + sweep);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = p.hsla(p.fastMod360(p.hueBase + 320), 100, 80, 0.12);
  ctx.lineWidth = 1.5;
  const gridLines = 12;
  for (let i = 0; i < gridLines; i++) {
    const y = (i / gridLines - 0.5) * rMax * 1.1;
    ctx.beginPath();
    ctx.moveTo(-rMax, y);
    ctx.lineTo(rMax, y);
    ctx.stroke();
  }

  ctx.restore();
}
