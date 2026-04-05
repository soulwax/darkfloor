import type { FlowFieldPatternContext } from "./types";

export function renderPulseLoomWeave(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0014;
  const lines = Math.max(
    10,
    Math.min(p.isFirefox ? 18 : 28, Math.round((p.width + p.height) / 70)),
  );
  const margin = 0.08;
  const x0 = p.width * margin;
  const x1 = p.width * (1 - margin);
  const y0 = p.height * margin;
  const y1 = p.height * (1 - margin);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let i = 0; i < lines; i++) {
    const fy = y0 + ((y1 - y0) * i) / (lines - 1);
    const wave =
      p.fastSin(t * 2 + i * 0.35) * p.height * 0.04 * (1 + bassIntensity);
    const hue = p.fastMod360(p.hueBase + i * 11 + t * 40);

    ctx.strokeStyle = p.hsla(hue, 100, 68, 0.07 + audioIntensity * 0.08);
    ctx.lineWidth = 1.2 + (i % 3) * 0.6 + trebleIntensity * 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, fy + wave);
    for (let s = 1; s <= 32; s++) {
      const x = x0 + ((x1 - x0) * s) / 32;
      const w =
        p.fastSin(t * 3 + i * 0.2 + s * 0.25) * 10 * (1 + audioIntensity);
      ctx.lineTo(x, fy + wave + w);
    }
    ctx.stroke();
  }

  for (let j = 0; j < lines; j++) {
    const fx = x0 + ((x1 - x0) * j) / (lines - 1);
    const wave =
      p.fastCos(t * 2.2 + j * 0.31) * p.width * 0.035 * (1 + trebleIntensity);
    const hue = p.fastMod360(p.hueBase + j * 13 + 140 + t * 35);

    ctx.strokeStyle = p.hsla(hue, 100, 64, 0.07 + audioIntensity * 0.08);
    ctx.lineWidth = 1.2 + (j % 4) * 0.5 + bassIntensity * 1.1;
    ctx.beginPath();
    ctx.moveTo(fx + wave, y0);
    for (let s = 1; s <= 32; s++) {
      const y = y0 + ((y1 - y0) * s) / 32;
      const w =
        p.fastCos(t * 2.8 + j * 0.18 + s * 0.22) * 9 * (1 + trebleIntensity);
      ctx.lineTo(fx + wave + w, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}
