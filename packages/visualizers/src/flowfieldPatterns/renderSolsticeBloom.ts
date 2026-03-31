import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderSolsticeBloom(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.72 : 1.08),
  );
  const ringCount = p.isFirefox ? 3 : 4;
  const petalCount = Math.max(
    12,
    Math.min(24, (12 + detailScale * 7 + bassIntensity * 7) | 0),
  );
  const sparkCount = Math.max(8, Math.min(20, (8 + detailScale * 8) | 0));
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.46;
  const coreRadius = minDimension * (0.08 + bassIntensity * 0.04);
  const time = p.time * 0.0022;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let ring = 0; ring < ringCount; ring++) {
    const ringProgress = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const baseRadius = maxRadius * (0.18 + ringProgress * 0.24);
    const rotation = time * (0.36 + ring * 0.14) + ring * 0.68;
    const petalStep = p.TWO_PI / petalCount;
    const petalSpread = petalStep * (0.38 + trebleIntensity * 0.08);

    for (let petal = 0; petal < petalCount; petal++) {
      const angle =
        petal * petalStep +
        rotation +
        p.fastSin(petal * 0.43 + time * 1.9 + ring * 0.6) * 0.08;
      const innerRadius = baseRadius * (0.34 + ringProgress * 0.08);
      const outerRadius =
        baseRadius *
        (0.84 +
          audioIntensity * 0.3 +
          p.fastCos(petal * 0.31 - time * 2.2 + ring) * 0.12);
      const midRadius = (innerRadius + outerRadius) * 0.62;
      const hue = p.fastMod360(
        p.hueBase + ring * 64 + petal * (420 / petalCount) + p.time * 0.04,
      );

      const leftInnerX = p.fastCos(angle - petalSpread * 0.45) * innerRadius;
      const leftInnerY = p.fastSin(angle - petalSpread * 0.45) * innerRadius;
      const leftMidX = p.fastCos(angle - petalSpread) * midRadius;
      const leftMidY = p.fastSin(angle - petalSpread) * midRadius;
      const tipX = p.fastCos(angle) * outerRadius;
      const tipY = p.fastSin(angle) * outerRadius;
      const rightMidX = p.fastCos(angle + petalSpread) * midRadius;
      const rightMidY = p.fastSin(angle + petalSpread) * midRadius;
      const rightInnerX = p.fastCos(angle + petalSpread * 0.45) * innerRadius;
      const rightInnerY = p.fastSin(angle + petalSpread * 0.45) * innerRadius;

      ctx.fillStyle = p.hsla(
        hue,
        100,
        56 + ringProgress * 16,
        0.08 + audioIntensity * 0.14,
      );
      ctx.beginPath();
      ctx.moveTo(leftInnerX, leftInnerY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(rightInnerX, rightInnerY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 58),
        100,
        82,
        clamp(0.08 + audioIntensity * 0.16 + ringProgress * 0.06, 0.08, 0.34),
      );
      ctx.lineWidth = 0.9 + trebleIntensity * 1.3 + (1 - ringProgress) * 0.8;
      ctx.stroke();
    }
  }

  for (let spark = 0; spark < sparkCount; spark++) {
    const orbit =
      (spark / sparkCount) * p.TWO_PI -
      time * (0.6 + spark * 0.01) +
      p.fastCos(spark * 0.52 + time * 1.2) * 0.08;
    const radius =
      maxRadius * (0.74 + (spark % 3) * 0.08) +
      p.fastSin(spark * 0.67 + time * 1.8) * maxRadius * 0.05;
    const x = p.fastCos(orbit) * radius;
    const y = p.fastSin(orbit) * radius;
    const size =
      1.8 + bassIntensity * 2 + (((spark + ringCount) & 1) === 0 ? 0.8 : 0.2);
    const hue = p.fastMod360(p.hueBase + 180 + spark * 18);

    ctx.fillStyle = p.hsla(hue, 100, 84, 0.18 + audioIntensity * 0.16);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 2.2);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 28), 100, 86, 0.18));
  core.addColorStop(0.55, p.hsla(p.fastMod360(p.hueBase + 176), 96, 56, 0.07));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 248), 84, 24, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 2.2, 0, p.TWO_PI);
  ctx.fill();

  ctx.fillStyle = p.hsla(p.fastMod360(p.hueBase + 220), 100, 88, 0.24);
  ctx.fillRect(-coreRadius * 0.9, -1.6, coreRadius * 1.8, 3.2);
  ctx.fillRect(-1.6, -coreRadius * 0.9, 3.2, coreRadius * 1.8);

  ctx.restore();
}
