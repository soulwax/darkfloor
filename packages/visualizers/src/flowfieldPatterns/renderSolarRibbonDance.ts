import type { FlowFieldPatternContext } from "./types";

export function renderSolarRibbonDance(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0018;
  const ribbons = p.isFirefox ? 5 : 8;
  const minDim = Math.min(p.width, p.height);
  const span = minDim * 0.42;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let i = 0; i < ribbons; i++) {
    const phase = t * (1.1 + i * 0.15) + i * 1.7;
    const hue = p.fastMod360(p.hueBase + i * 42 + bassIntensity * 35);
    const amp = span * (0.18 + (i / ribbons) * 0.22 + audioIntensity * 0.12);
    const steps = 48;

    ctx.save();
    ctx.rotate(
      (i / ribbons) * p.TWO_PI + t * 0.14 * (i % 2 === 0 ? 1 : -1),
    );

    ctx.lineWidth = 2.4 + trebleIntensity * 2 + (ribbons - i) * 0.25;
    const g = ctx.createLinearGradient(-span, 0, span, 0);
    g.addColorStop(0, p.hsla(p.fastMod360(hue - 30), 100, 55, 0));
    g.addColorStop(0.5, p.hsla(hue, 100, 68, 0.22 + audioIntensity * 0.12));
    g.addColorStop(1, p.hsla(p.fastMod360(hue + 40), 100, 52, 0));
    ctx.strokeStyle = g;

    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const u = (s / steps) * 2 - 1;
      const x = u * span;
      const wave =
        p.fastSin(u * 5 + phase) * amp +
        p.fastCos(u * 8 - phase * 1.3) * amp * 0.35;
      const y =
        wave +
        p.fastSin(phase + u * p.TWO_PI) * amp * 0.2 * (1 + bassIntensity);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, span * 0.35);
  glow.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 28), 100, 85, 0.18));
  glow.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 200), 90, 40, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, span * 0.35, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
