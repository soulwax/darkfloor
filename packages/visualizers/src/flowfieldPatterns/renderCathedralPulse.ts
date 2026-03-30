import type { FlowFieldPatternContext } from "./types";

function drawArch(
  ctx: CanvasRenderingContext2D,
  halfWidth: number,
  baseY: number,
  apexY: number,
  sideInset: number,
): void {
  ctx.beginPath();
  ctx.moveTo(-halfWidth, baseY);
  ctx.lineTo(-halfWidth + sideInset, baseY);
  ctx.quadraticCurveTo(0, apexY, halfWidth - sideInset, baseY);
  ctx.lineTo(halfWidth, baseY);
  ctx.stroke();
}

export function renderCathedralPulse(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  midIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = p.detailScale * (p.isFirefox ? 0.72 : 1);
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.48;
  const roseRadius = minDimension * (0.16 + bassIntensity * 0.07);
  const spokeCount = Math.max(
    12,
    Math.min(26, (12 + detailScale * 8 + bassIntensity * 10) | 0),
  );
  const archCount = Math.max(
    3,
    Math.min(6, (3 + detailScale * 2 + bassIntensity * 2) | 0),
  );
  const glintCount = Math.max(8, Math.min(20, (8 + detailScale * 8) | 0));
  const time = p.time * 0.0018;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const aura = ctx.createRadialGradient(
    0,
    -minDimension * 0.08,
    roseRadius * 0.12,
    0,
    0,
    maxRadius,
  );
  aura.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 18), 100, 76, 0.2));
  aura.addColorStop(0.45, p.hsla(p.fastMod360(p.hueBase + 170), 92, 52, 0.09));
  aura.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 250), 88, 22, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius, 0, p.TWO_PI);
  ctx.fill();

  for (let ring = 0; ring < 4; ring++) {
    const radius = roseRadius * (0.44 + ring * 0.2);
    const hue = p.fastMod360(p.hueBase + 22 + ring * 38 + p.time * 0.02);
    ctx.strokeStyle = p.hsla(hue, 100, 70 + ring * 3, 0.08 + audioIntensity * 0.12);
    ctx.lineWidth = 1.2 + (3 - ring) * 0.55 + bassIntensity * 1.2;
    ctx.beginPath();
    ctx.arc(0, -roseRadius * 0.02, radius, 0, p.TWO_PI);
    ctx.stroke();
  }

  const spokeStep = p.TWO_PI / spokeCount;
  for (let spoke = 0; spoke < spokeCount; spoke++) {
    const angle =
      spoke * spokeStep +
      time * 0.48 +
      p.fastSin(spoke * 0.47 + time * 1.6) * 0.08;
    const innerRadius = roseRadius * 0.18;
    const outerRadius =
      roseRadius *
      (0.8 + p.fastCos(spoke * 0.63 - time * 1.1) * 0.08 + midIntensity * 0.1);
    const x1 = p.fastCos(angle) * innerRadius;
    const y1 = p.fastSin(angle) * innerRadius;
    const x2 = p.fastCos(angle) * outerRadius;
    const y2 = p.fastSin(angle) * outerRadius;
    const hue = p.fastMod360(p.hueBase + 40 + spoke * (300 / spokeCount));

    ctx.strokeStyle = p.hsla(hue, 100, 76, 0.11 + audioIntensity * 0.18);
    ctx.lineWidth = 1 + bassIntensity * 1.8 + ((spoke & 1) === 0 ? 0.45 : 0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  for (let arch = 0; arch < archCount; arch++) {
    const progress = archCount > 1 ? arch / (archCount - 1) : 0;
    const halfWidth = maxRadius * (0.34 + progress * 0.24);
    const baseY = maxRadius * (0.38 - progress * 0.08);
    const apexY =
      -maxRadius * (0.46 + progress * 0.13) -
      p.fastCos(time * 1.3 + arch * 0.9) * maxRadius * 0.04;
    const hue = p.fastMod360(p.hueBase + 12 + arch * 34 + p.time * 0.04);

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      66 + progress * 10,
      0.11 + audioIntensity * 0.16,
    );
    ctx.lineWidth = 1.6 + (1 - progress) * 2.4 + bassIntensity * 1.7;
    drawArch(ctx, halfWidth, baseY, apexY, 8 + progress * 10);

    ctx.strokeStyle = p.hsla(
      p.fastMod360(hue + 90),
      100,
      82,
      0.06 + midIntensity * 0.14,
    );
    ctx.lineWidth = 0.9 + (1 - progress) * 1.1;
    drawArch(ctx, halfWidth * 0.72, baseY - 8, apexY * 0.72, 5 + progress * 8);

    const mullionOffset = halfWidth * 0.42;
    ctx.beginPath();
    ctx.moveTo(-mullionOffset, baseY);
    ctx.lineTo(-mullionOffset * 0.84, apexY * 0.34);
    ctx.moveTo(mullionOffset, baseY);
    ctx.lineTo(mullionOffset * 0.84, apexY * 0.34);
    ctx.moveTo(0, baseY);
    ctx.lineTo(0, apexY * 0.4);
    ctx.stroke();
  }

  ctx.strokeStyle = p.hsla(p.fastMod360(p.hueBase + 208), 100, 78, 0.1);
  ctx.lineWidth = 1.3 + midIntensity * 1.3;
  ctx.beginPath();
  ctx.moveTo(-maxRadius * 0.52, maxRadius * 0.46);
  ctx.lineTo(maxRadius * 0.52, maxRadius * 0.46);
  ctx.moveTo(-maxRadius * 0.38, maxRadius * 0.6);
  ctx.lineTo(maxRadius * 0.38, maxRadius * 0.6);
  ctx.stroke();

  for (let glint = 0; glint < glintCount; glint++) {
    const angle = glint * 0.71 + time * 0.85;
    const radius =
      roseRadius * (0.78 + ((glint % 3) * 0.22)) +
      p.fastSin(glint * 0.93 + time * 1.8) * roseRadius * 0.08;
    const x = p.fastCos(angle) * radius;
    const y = p.fastSin(angle) * radius - roseRadius * 0.03;
    const size =
      1.6 + audioIntensity * 2 + ((glint & 1) === 0 ? 0.7 : 0.15);
    const hue = p.fastMod360(p.hueBase + 150 + glint * 16);

    ctx.fillStyle = p.hsla(hue, 100, 84, 0.16 + audioIntensity * 0.15);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }

  ctx.restore();
}
