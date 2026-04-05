import type { FlowFieldPatternContext } from "./types";

export function renderNeonRippleGarden(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0022;
  const minDim = Math.min(p.width, p.height);
  const maxR = minDim * 0.48;
  const rings = p.isFirefox ? 9 : 14;
  const spokes = p.isFirefox ? 10 : 16;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let r = 0; r < rings; r++) {
    const phase = (r / rings) * p.TWO_PI + t * (0.9 + bassIntensity * 0.4);
    const radius =
      maxR * (0.08 + (r / rings) * 0.92) +
      p.fastSin(phase * 3 + r * 0.4) * maxR * 0.02;
    const wobble = 1 + trebleIntensity * 0.35 + audioIntensity * 0.2;
    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + r * 22 + trebleIntensity * 40),
      100,
      62,
      0.045 + audioIntensity * 0.07,
    );
    ctx.lineWidth = 1.2 + (rings - r) * 0.14 * wobble;
    ctx.beginPath();
    for (let s = 0; s <= 96; s++) {
      const a = (s / 96) * p.TWO_PI;
      const warp =
        p.fastSin(a * spokes + phase) * 6 * wobble +
        p.fastCos(a * 2 + t * 4) * 3;
      const rr = radius + warp;
      const x = p.fastCos(a) * rr;
      const y = p.fastSin(a) * rr;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * p.TWO_PI + t * 0.6;
    const hue = p.fastMod360(p.hueBase + i * (360 / spokes) + bassIntensity * 30);
    const len = maxR * (0.55 + audioIntensity * 0.25);
    ctx.strokeStyle = p.hsla(hue, 100, 72, 0.08 + trebleIntensity * 0.1);
    ctx.lineWidth = 1.4 + bassIntensity * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.fastCos(a) * len, p.fastSin(a) * len);
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.2);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 40), 100, 88, 0.2));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 200), 90, 40, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * 0.2, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
