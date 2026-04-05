import type { FlowFieldPatternContext } from "./types";

export function renderScarabGeometryPulse(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const t = p.time * 0.002;
  const minDim = Math.min(p.width, p.height);
  const bodyW = minDim * 0.22 * (1 + bassIntensity * 0.15);
  const bodyH = minDim * 0.32;
  const wingSpan = minDim * 0.4;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";

  const drawBody = () => {
    const hue = p.fastMod360(p.hueBase + 120 + trebleIntensity * 40);
    ctx.fillStyle = p.hsla(hue, 92, 48, 0.35 + audioIntensity * 0.15);
    ctx.strokeStyle = p.hsla(p.fastMod360(hue + 40), 100, 72, 0.5);
    ctx.lineWidth = 2 + bassIntensity * 2;

    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, p.TWO_PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -bodyH);
    ctx.lineTo(-bodyW * 0.35, -bodyH * 1.25);
    ctx.lineTo(bodyW * 0.35, -bodyH * 1.25);
    ctx.closePath();
    ctx.fillStyle = p.hsla(p.fastMod360(hue + 60), 100, 55, 0.4);
    ctx.fill();
    ctx.stroke();
  };

  const drawWing = (side: number) => {
    ctx.save();
    ctx.scale(side, 1);
    const layers = 4;
    for (let L = 0; L < layers; L++) {
      const spread = wingSpan * (0.45 + L * 0.14) + p.fastSin(t + L) * 8;
      const hue = p.fastMod360(p.hueBase + L * 45 + t * 35);
      ctx.strokeStyle = p.hsla(hue, 100, 65, 0.12 + audioIntensity * 0.1);
      ctx.lineWidth = 2.2 + trebleIntensity * 2;

      ctx.beginPath();
      ctx.moveTo(bodyW * 0.9, -bodyH * 0.2);
      ctx.quadraticCurveTo(
        spread,
        -bodyH * 0.55 + L * 6,
        spread * 0.95,
        bodyH * 0.35,
      );
      ctx.quadraticCurveTo(
        bodyW * 1.1,
        bodyH * 0.15,
        bodyW * 0.9,
        -bodyH * 0.2,
      );
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = p.hsla(p.fastMod360(hue + 20), 100, 52, 0.06);
      ctx.fill();
    }
    ctx.restore();
  };

  drawBody();
  drawWing(1);
  drawWing(-1);

  const ringR = bodyH * 1.1 + audioIntensity * 20;
  ctx.strokeStyle = p.hsla(p.fastMod360(p.hueBase + 200), 100, 70, 0.2);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, ringR + p.fastSin(t * 3) * 6, 0, p.TWO_PI);
  ctx.stroke();

  ctx.restore();
}
