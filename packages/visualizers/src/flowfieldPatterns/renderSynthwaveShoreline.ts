import type { FlowFieldPatternContext } from "./types";

export function renderSynthwaveShoreline(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0018;
  const w = p.width;
  const h = p.height;
  const horizon = h * (0.38 + p.fastSin(t * 0.5) * 0.02);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 280), 95, 22, 1));
  sky.addColorStop(0.45, p.hsla(p.fastMod360(p.hueBase + 320), 100, 38, 1));
  sky.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 350), 100, 62, 1));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  const sunR = Math.min(w, h) * 0.12 * (1 + bassIntensity * 0.2);
  const sunCx = w * 0.5 + p.fastSin(t * 0.4) * w * 0.04;
  const sunCy = horizon - sunR * 0.35;
  const sunG = ctx.createRadialGradient(sunCx, sunCy, 0, sunCx, sunCy, sunR * 1.8);
  sunG.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 38), 100, 72, 0.9));
  sunG.addColorStop(0.5, p.hsla(p.fastMod360(p.hueBase + 8), 100, 58, 0.5));
  sunG.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 320), 90, 45, 0));
  ctx.fillStyle = sunG;
  ctx.beginPath();
  ctx.arc(sunCx, sunCy, sunR * 1.8, 0, p.TWO_PI);
  ctx.fill();
  ctx.fillStyle = p.hsla(p.fastMod360(p.hueBase + 45), 100, 68, 0.95);
  ctx.beginPath();
  ctx.arc(sunCx, sunCy, sunR, 0, p.TWO_PI);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 300), 85, 18, 1));
  ground.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 260), 90, 8, 1));
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rows = p.isFirefox ? 10 : 18;
  const vanishX = w * 0.5;
  const vanishY = horizon;
  for (let r = 0; r < rows; r++) {
    const prog = r / rows;
    const y = horizon + (h - horizon) * (0.05 + prog * 0.92);
    const spread = w * (0.08 + prog * 0.92);
    const hue = p.fastMod360(p.hueBase + 300 + r * 6 + trebleIntensity * 20);
    ctx.strokeStyle = p.hsla(hue, 100, 65, 0.15 + (1 - prog) * 0.25 + audioIntensity * 0.1);
    ctx.lineWidth = 1 + (1 - prog) * 3;
    ctx.beginPath();
    ctx.moveTo(vanishX - spread, y);
    ctx.lineTo(vanishX + spread, y);
    ctx.stroke();
  }

  const cols = p.isFirefox ? 9 : 15;
  for (let c = 0; c < cols; c++) {
    const offset = (c / cols - 0.5) * 2;
    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + 310 + c * 8),
      100,
      58,
      0.12 + audioIntensity * 0.08,
    );
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(vanishX + offset * w * 0.04, vanishY);
    ctx.lineTo(vanishX + offset * w * 0.55, h * 0.98);
    ctx.stroke();
  }
  ctx.restore();
}
