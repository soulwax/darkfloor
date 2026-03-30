import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderPrismCells(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = p.detailScale * (p.isFirefox ? 0.74 : 1);
  const cols = Math.max(
    10,
    Math.min(28, (12 + detailScale * 7 + bassIntensity * 10) | 0),
  );
  const rows = Math.max(
    8,
    Math.min(20, (((cols * p.height) / p.width) * 0.82) | 0),
  );
  const cellW = p.width / cols;
  const cellH = p.height / rows;
  const innerW = cellW * 0.68;
  const innerH = cellH * 0.68;
  const time = p.time * 0.0018;
  const chromaShift = 1.5 + trebleIntensity * 4.5;
  const lineAlpha = 0.1 + audioIntensity * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let row = 0; row < rows; row++) {
    const rowPhase = time * 2 + row * 0.41;
    const rowOffset = p.fastSin(rowPhase) * cellW * 0.16;
    const baseY = row * cellH;

    for (let col = 0; col < cols; col++) {
      const baseX = col * cellW + rowOffset;
      const dx = baseX + cellW * 0.5 - p.centerX;
      const dy = baseY + cellH * 0.5 - p.centerY;
      const dist = p.fastSqrt(dx * dx + dy * dy);
      const pulse =
        p.fastSin(dist * 0.035 - time * 8 + col * 0.27 + row * 0.19) * 0.5 +
        0.5;

      if (p.isFirefox && pulse < 0.14 && ((col + row) & 1) === 1) {
        continue;
      }

      const hue = p.fastMod360(
        p.hueBase + dist * 0.24 + col * 9 + row * 15 + pulse * 120,
      );
      const insetX = baseX + cellW * 0.16;
      const insetY =
        baseY +
        cellH * 0.16 +
        p.fastCos(time * 3 + col * 0.38 + row * 0.14) * cellH * 0.05;
      const widthScale = 0.82 + pulse * 0.28;
      const heightScale = 0.78 + pulse * 0.32;
      const rectW = innerW * widthScale;
      const rectH = innerH * heightScale;
      const lightness = clamp(48 + pulse * 26 - dist * 0.015, 36, 82);

      ctx.fillStyle = p.hsla(
        hue,
        100,
        lightness + 6,
        0.12 + pulse * 0.14 + audioIntensity * 0.1,
      );
      ctx.fillRect(insetX - chromaShift, insetY, rectW, rectH);

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 34),
        100,
        lightness,
        0.08 + pulse * 0.12 + bassIntensity * 0.08,
      );
      ctx.fillRect(
        insetX + chromaShift,
        insetY + chromaShift * 0.35,
        rectW,
        rectH,
      );

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 78),
        100,
        lightness + 10,
        0.08 + pulse * 0.14 + trebleIntensity * 0.08,
      );
      ctx.fillRect(insetX, insetY - chromaShift * 0.35, rectW, rectH);

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 118),
        100,
        lightness + 14,
        lineAlpha + pulse * 0.18,
      );
      ctx.lineWidth = 0.8 + pulse * 1.6;
      ctx.beginPath();
      if (((col + row) & 1) === 0) {
        ctx.moveTo(insetX, insetY + rectH);
        ctx.lineTo(insetX + rectW, insetY);
      } else {
        ctx.moveTo(insetX, insetY);
        ctx.lineTo(insetX + rectW, insetY + rectH);
      }
      ctx.stroke();

      if (!p.isFirefox || pulse > 0.62) {
        ctx.strokeStyle = p.hsla(
          p.fastMod360(hue + 180),
          96,
          lightness + 18,
          0.05 + pulse * 0.12,
        );
        ctx.lineWidth = 0.7;
        ctx.strokeRect(insetX, insetY, rectW, rectH);
      }
    }
  }

  ctx.restore();
}
