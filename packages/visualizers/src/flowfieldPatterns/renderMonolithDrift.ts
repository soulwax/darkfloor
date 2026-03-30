import type { FlowFieldPatternContext } from "./types";

export function renderMonolithDrift(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = p.detailScale * (p.isFirefox ? 0.74 : 1);
  const columnCount = Math.max(
    5,
    Math.min(11, (5 + detailScale * 4 + bassIntensity * 3) | 0),
  );
  const horizonY = p.height * (0.58 + p.fastSin(p.time * 0.00023) * 0.015);
  const time = p.time * 0.0016;

  ctx.save();

  const haze = ctx.createLinearGradient(0, 0, 0, p.height);
  haze.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 218), 84, 18, 0.08));
  haze.addColorStop(
    0.55,
    p.hsla(p.fastMod360(p.hueBase + 168), 90, 20, 0.04 + bassIntensity * 0.05),
  );
  haze.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 248), 80, 10, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, p.width, p.height);

  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = p.hsla(p.fastMod360(p.hueBase + 185), 100, 74, 0.08);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(p.width, horizonY);
  ctx.stroke();

  for (let index = 0; index < columnCount; index++) {
    const progress = columnCount > 1 ? index / (columnCount - 1) : 0.5;
    const centered = progress - 0.5;
    const prominence = 1 - Math.abs(centered) * 1.15;
    const drift = p.fastSin(time * 0.82 + index * 0.91) * p.width * 0.018;
    const x = progress * p.width + drift;
    const width = 14 + prominence * 28 + bassIntensity * 10;
    const height =
      p.height * (0.18 + prominence * 0.34 + bassIntensity * 0.12) +
      p.fastCos(time * 1.4 + index * 1.7) * p.height * 0.03;
    const y = horizonY - height;
    const hue = p.fastMod360(
      p.hueBase + 18 + prominence * 48 + index * (150 / columnCount),
    );

    const fill = ctx.createLinearGradient(x, y, x, horizonY);
    fill.addColorStop(0, p.hsla(hue, 100, 80, 0.12 + audioIntensity * 0.16));
    fill.addColorStop(0.22, p.hsla(p.fastMod360(hue + 22), 96, 42, 0.16));
    fill.addColorStop(1, p.hsla(p.fastMod360(hue + 78), 88, 18, 0.02));
    ctx.fillStyle = fill;
    ctx.fillRect(x - width * 0.5, y, width, height);

    ctx.fillStyle = p.hsla(hue, 100, 88, 0.15 + trebleIntensity * 0.16);
    ctx.fillRect(x - width * 0.34, y, width * 0.08, height);
    ctx.fillRect(x + width * 0.18, y, width * 0.05, height);

    ctx.strokeStyle = p.hsla(
      p.fastMod360(hue + 110),
      100,
      82,
      0.1 + audioIntensity * 0.14,
    );
    ctx.lineWidth = 1 + prominence * 1.3;
    ctx.strokeRect(x - width * 0.5, y, width, height);

    ctx.fillStyle = p.hsla(hue, 100, 88, 0.18 + trebleIntensity * 0.16);
    ctx.fillRect(x - width * 0.46, y - 2.5, width * 0.92, 2.5);

    const reflection = ctx.createLinearGradient(x, horizonY, x, horizonY + height * 0.55);
    reflection.addColorStop(0, p.hsla(hue, 100, 80, 0.08 + audioIntensity * 0.08));
    reflection.addColorStop(1, p.hsla(hue, 100, 20, 0));
    ctx.fillStyle = reflection;
    ctx.fillRect(x - width * 0.4, horizonY, width * 0.8, height * 0.55);
  }

  const beamCount = Math.max(3, Math.min(6, (3 + detailScale * 2) | 0));
  for (let beam = 0; beam < beamCount; beam++) {
    const beamX =
      (((time * 0.08 + beam * 0.19) % 1 + 1) % 1) * p.width;
    const beamWidth = 16 + bassIntensity * 24 + beam * 6;
    const beamGradient = ctx.createLinearGradient(beamX, 0, beamX, p.height);
    beamGradient.addColorStop(
      0,
      p.hsla(p.fastMod360(p.hueBase + 140 + beam * 28), 100, 82, 0),
    );
    beamGradient.addColorStop(
      0.4,
      p.hsla(p.fastMod360(p.hueBase + 140 + beam * 28), 100, 82, 0.06),
    );
    beamGradient.addColorStop(
      1,
      p.hsla(p.fastMod360(p.hueBase + 240 + beam * 28), 100, 28, 0),
    );
    ctx.fillStyle = beamGradient;
    ctx.fillRect(beamX - beamWidth * 0.5, 0, beamWidth, p.height);
  }

  ctx.restore();
}
