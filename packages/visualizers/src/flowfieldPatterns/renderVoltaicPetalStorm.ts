import type { FlowFieldPatternContext } from "./types";

export function renderVoltaicPetalStorm(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.002;
  const layers = p.isFirefox ? 4 : 6;
  const petals = 11;
  const minDim = Math.min(p.width, p.height);
  const maxR = minDim * 0.44;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";

  for (let layer = 0; layer < layers; layer++) {
    const spin = t * (0.5 + layer * 0.12) * (layer % 2 === 0 ? 1 : -1);
    const scale = 0.35 + (layer / layers) * 0.65 + bassIntensity * 0.12;

    for (let k = 0; k < petals; k++) {
      const baseA = (k / petals) * p.TWO_PI + spin;
      const hue = p.fastMod360(
        p.hueBase + layer * 28 + k * (330 / petals) + trebleIntensity * 45,
      );
      const r0 = maxR * 0.06 * scale;
      const r1 = maxR * scale * (0.42 + audioIntensity * 0.18);
      const midA = baseA + p.fastSin(t * 2 + k) * 0.08;

      ctx.fillStyle = p.hsla(hue, 100, 58, 0.07 + audioIntensity * 0.06);
      ctx.strokeStyle = p.hsla(p.fastMod360(hue + 18), 100, 78, 0.14 + trebleIntensity * 0.12);
      ctx.lineWidth = 1.2 + bassIntensity * 1.8;

      ctx.beginPath();
      ctx.moveTo(p.fastCos(baseA) * r0, p.fastSin(baseA) * r0);
      ctx.quadraticCurveTo(
        p.fastCos(midA + 0.35) * r1 * 0.72,
        p.fastSin(midA + 0.35) * r1 * 0.72,
        p.fastCos(midA + 0.7) * r1 * 0.35,
        p.fastSin(midA + 0.7) * r1 * 0.35,
      );
      ctx.quadraticCurveTo(
        p.fastCos(midA - 0.35) * r1 * 0.72,
        p.fastSin(midA - 0.35) * r1 * 0.72,
        p.fastCos(baseA) * r0,
        p.fastSin(baseA) * r0,
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * 0.16);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 52), 100, 90, 0.35));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 280), 100, 45, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, maxR * 0.16, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
