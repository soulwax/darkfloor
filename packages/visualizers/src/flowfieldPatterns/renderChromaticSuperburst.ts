import type { FlowFieldPatternContext } from "./types";

export function renderChromaticSuperburst(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0028;
  const rays = p.isFirefox ? 48 : 72;
  const minDim = Math.min(p.width, p.height);
  const reach = minDim * 0.55;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * p.TWO_PI + t * 0.35;
    const pulse = 0.65 + bassIntensity * 0.45 + p.fastSin(t * 3 + i * 0.2) * 0.12;
    const hue = p.fastMod360(p.hueBase + i * (360 / rays) + t * 40);
    const len = reach * pulse * (0.4 + ((i * 7) % 5) * 0.12);

    const g = ctx.createLinearGradient(0, 0, p.fastCos(a) * len, p.fastSin(a) * len);
    g.addColorStop(0, p.hsla(hue, 100, 92, 0.35 + audioIntensity * 0.25));
    g.addColorStop(0.45, p.hsla(p.fastMod360(hue + 40), 100, 65, 0.12));
    g.addColorStop(1, p.hsla(p.fastMod360(hue + 80), 95, 45, 0));

    ctx.strokeStyle = g;
    ctx.lineWidth = 1.8 + trebleIntensity * 2.2 + (i % 4) * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.fastCos(a) * len, p.fastSin(a) * len);
    ctx.stroke();
  }

  const shells = 5;
  for (let s = 0; s < shells; s++) {
    const rad =
      reach * (0.12 + (s / shells) * 0.35) +
      p.fastSin(t * 2.2 + s) * reach * 0.04;
    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + s * 48 + trebleIntensity * 60),
      100,
      70,
      0.06 + audioIntensity * 0.08,
    );
    ctx.lineWidth = 2 + s * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, p.TWO_PI);
    ctx.stroke();
  }

  ctx.restore();
}
