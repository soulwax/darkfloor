import type { FlowFieldPatternContext } from "./types";

export function renderIridescentShatterField(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0022;
  const minDim = Math.min(p.width, p.height);
  const shards = p.isFirefox ? 36 : 56;
  const maxLen = minDim * 0.48;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < shards; i++) {
    const baseA = (i / shards) * p.TWO_PI + t * 0.25;
    const len =
      maxLen * (0.25 + ((i * 11) % 7) * 0.08 + audioIntensity * 0.2) +
      bassIntensity * 22;
    const w = 8 + trebleIntensity * 10 + (i % 5);
    const hue = p.fastMod360(p.hueBase + i * (360 / shards) + t * 45);
    const jitter = p.fastSin(t * 3 + i) * 0.12;

    ctx.save();
    ctx.rotate(baseA + jitter);

    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, p.hsla(hue, 100, 88, 0.35 + audioIntensity * 0.2));
    g.addColorStop(0.55, p.hsla(p.fastMod360(hue + 80), 100, 58, 0.18));
    g.addColorStop(1, p.hsla(p.fastMod360(hue + 140), 95, 42, 0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, -w * 0.5);
    ctx.lineTo(len * 0.92, 0);
    ctx.lineTo(len, w * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = p.hsla(p.fastMod360(hue + 40), 100, 80, 0.25);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  }

  const crackle = ctx.createRadialGradient(0, 0, 0, 0, 0, maxLen * 0.25);
  crackle.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 60), 100, 92, 0.2));
  crackle.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 200), 80, 40, 0));
  ctx.fillStyle = crackle;
  ctx.beginPath();
  ctx.arc(0, 0, maxLen * 0.25, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
