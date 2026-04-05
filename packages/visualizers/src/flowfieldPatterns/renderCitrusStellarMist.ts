import type { FlowFieldPatternContext } from "./types";

export function renderCitrusStellarMist(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0012;
  const w = p.width;
  const h = p.height;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 18), 100, 52, 0.45));
  bg.addColorStop(0.45, p.hsla(p.fastMod360(p.hueBase + 48), 100, 58, 0.35));
  bg.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 210), 95, 38, 0.5));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const blobs = p.isFirefox ? 6 : 10;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let b = 0; b < blobs; b++) {
    const bx =
      w * (0.15 + ((b * 17) % 7) * 0.12) +
      p.fastSin(t + b * 1.1) * w * 0.06;
    const by =
      h * (0.12 + ((b * 23) % 6) * 0.14) +
      p.fastCos(t * 0.9 + b) * h * 0.07;
    const br = Math.min(w, h) * (0.12 + (b % 3) * 0.05 + bassIntensity * 0.06);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const hue = p.fastMod360(p.hueBase + b * 55 + 20);
    g.addColorStop(0, p.hsla(hue, 100, 72, 0.2 + audioIntensity * 0.12));
    g.addColorStop(1, p.hsla(p.fastMod360(hue + 80), 90, 45, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, p.TWO_PI);
    ctx.fill();
  }

  const stars = p.isFirefox ? 80 : 140;
  for (let s = 0; s < stars; s++) {
    const sx = ((s * 97.3) % 1) * w;
    const sy = ((s * 53.7 + 0.3) % 1) * h;
    const tw = 0.4 + p.fastSin(t * 4 + s * 0.7) * 0.35 + trebleIntensity * 0.5;
    const hue = p.fastMod360(p.hueBase + s * 13 + 40);
    ctx.fillStyle = p.hsla(hue, 100, 88, 0.15 + tw * 0.25);
    const sz = 1 + (s % 4) + audioIntensity * 2;
    ctx.fillRect(sx, sy, sz, sz);
  }

  ctx.restore();
}
