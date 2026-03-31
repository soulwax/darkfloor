import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderGlitchMosaic(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.64 : 1.05),
  );
  const cols = Math.max(
    12,
    Math.min(
      p.isFirefox ? 28 : 32,
      (14 + detailScale * 8 + bassIntensity * 10) | 0,
    ),
  );
  const rows = Math.max(
    8,
    Math.min(20, (((cols * p.height) / p.width) * 0.82) | 0),
  );
  const cellW = p.width / cols;
  const cellH = p.height / rows;
  const time = p.time * 0.0019;
  const chromaShift = 1.6 + trebleIntensity * 4.2 + audioIntensity * 1.1;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let row = 0; row < rows; row++) {
    const rowWave = p.fastSin(time * 2.2 + row * 0.37) * cellW * 0.08;
    const rowHueShift = row * 13 + p.fastCos(time * 1.1 + row * 0.21) * 30;

    for (let col = 0; col < cols; col++) {
      const x = col * cellW + rowWave;
      const y = row * cellH;
      const dx = x + cellW * 0.5 - p.centerX;
      const dy = y + cellH * 0.5 - p.centerY;
      const dist = p.fastSqrt(dx * dx + dy * dy);
      const pulse =
        p.fastSin(dist * 0.032 - time * 9 + col * 0.41 - row * 0.23) * 0.5 +
        0.5;

      if (p.isFirefox && pulse < 0.18 && ((col ^ row) & 1) === 1) {
        continue;
      }

      const hue = p.fastMod360(
        p.hueBase + rowHueShift + col * 11 + pulse * 160 + dist * 0.12,
      );
      const bodyX =
        x + cellW * 0.11 + p.fastSin(time * 3.6 + row * 0.19) * cellW * 0.04;
      const bodyY =
        y +
        cellH * 0.16 +
        p.fastCos(time * 3.1 + col * 0.27 + row * 0.14) * cellH * 0.06;
      const bodyW = cellW * (0.52 + pulse * 0.18);
      const bodyH = cellH * (0.34 + pulse * 0.22);
      const bandY =
        y +
        cellH * (0.1 + ((col + row) & 3) * 0.18) +
        p.fastCos(time * 2.8 + col * 0.31) * cellH * 0.05;
      const bandW = cellW * (0.76 + pulse * 0.14);
      const bandH = cellH * (0.18 + pulse * 0.24);
      const lightness = clamp(48 + pulse * 30 - dist * 0.01, 36, 84);

      ctx.fillStyle = p.hsla(
        hue,
        100,
        lightness + 8,
        0.14 + pulse * 0.16 + audioIntensity * 0.1,
      );
      ctx.fillRect(bodyX - chromaShift, bodyY, bodyW, bodyH);

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 34),
        100,
        lightness,
        0.1 + pulse * 0.14 + bassIntensity * 0.1,
      );
      ctx.fillRect(
        bodyX + chromaShift,
        bodyY + chromaShift * 0.3,
        bodyW,
        bodyH,
      );

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 84),
        100,
        lightness + 10,
        0.1 + pulse * 0.16 + trebleIntensity * 0.1,
      );
      ctx.fillRect(bodyX, bandY, bandW, bandH);

      if (pulse > 0.44 && (!p.isFirefox || ((col + row) & 1) === 0)) {
        ctx.fillStyle = p.hsla(
          p.fastMod360(hue + 162),
          100,
          82,
          0.1 + pulse * 0.12,
        );
        ctx.fillRect(
          bodyX + bodyW * 0.16,
          bodyY + bodyH * 0.18,
          bodyW * (0.14 + pulse * 0.08),
          bodyH * 0.2,
        );
      }

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 132),
        100,
        lightness + 16,
        0.1 + pulse * 0.18,
      );
      ctx.lineWidth = 0.9 + pulse * 1.6 + bassIntensity * 0.3;
      ctx.beginPath();
      if (((col + row) & 1) === 0) {
        ctx.moveTo(bodyX, bodyY + bodyH);
        ctx.lineTo(bodyX + bodyW, bodyY);
      } else {
        ctx.moveTo(bodyX, bodyY);
        ctx.lineTo(bodyX + bodyW, bodyY + bodyH);
      }
      ctx.stroke();

      if (pulse > 0.56) {
        const sparkSize =
          1.7 + trebleIntensity * 1.7 + (((col + row) & 1) === 0 ? 0.5 : 0.1);
        ctx.fillStyle = p.hsla(
          p.fastMod360(hue + 196),
          100,
          84,
          0.18 + audioIntensity * 0.18,
        );
        ctx.fillRect(
          bodyX + bodyW - sparkSize * 0.8,
          bodyY + sparkSize * 0.2,
          sparkSize,
          sparkSize,
        );
      }
    }
  }

  ctx.restore();
}
