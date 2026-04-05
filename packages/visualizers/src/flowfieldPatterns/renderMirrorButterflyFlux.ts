import type { FlowFieldPatternContext } from "./types";

export function renderMirrorButterflyFlux(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.0024;
  const minDim = Math.min(p.width, p.height);
  const wing = minDim * 0.38;
  const veins = p.isFirefox ? 7 : 11;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  const drawWing = (flipX: number) => {
    ctx.save();
    ctx.scale(flipX, 1);

    for (let v = 0; v < veins; v++) {
      const vProg = v / Math.max(1, veins - 1);
      const hue = p.fastMod360(
        p.hueBase + v * 28 + trebleIntensity * 50 + t * 30,
      );
      ctx.strokeStyle = p.hsla(hue, 100, 68, 0.1 + audioIntensity * 0.1);
      ctx.lineWidth = 1.4 + (1 - vProg) * 2.2 + bassIntensity * 1.5;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      const cx = wing * (0.35 + vProg * 0.45);
      const cy =
        (vProg - 0.5) * wing * 0.9 + p.fastSin(t * 2 + v) * wing * 0.06;
      const ex = wing * (0.92 + audioIntensity * 0.06);
      const ey = (vProg - 0.5) * wing * 1.05 + p.fastCos(t * 1.7 + v * 0.8) * 12;
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    }

    const patchSteps = 24;
    for (let s = 0; s < patchSteps; s++) {
      const u = s / patchSteps;
      const px = wing * (0.2 + u * 0.75);
      const py =
        p.fastSin(u * p.TWO_PI * 2 + t * 3) * wing * 0.22 * (0.5 + bassIntensity);
      const sz = 3 + trebleIntensity * 4 + u * 5;
      ctx.fillStyle = p.hsla(
        p.fastMod360(p.hueBase + u * 120 + s * 5),
        100,
        72,
        0.08 + audioIntensity * 0.07,
      );
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, p.TWO_PI);
      ctx.fill();
    }

    ctx.restore();
  };

  drawWing(1);
  drawWing(-1);

  ctx.strokeStyle = p.hsla(p.fastMod360(p.hueBase + 160), 100, 75, 0.35);
  ctx.lineWidth = 2 + bassIntensity * 2;
  ctx.beginPath();
  ctx.moveTo(0, -wing * 0.15);
  ctx.lineTo(0, wing * 0.15);
  ctx.stroke();

  ctx.restore();
}
