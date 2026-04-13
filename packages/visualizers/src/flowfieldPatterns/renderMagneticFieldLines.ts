import type { FlowFieldPatternContext } from "./types";

interface FieldVector {
  x: number;
  y: number;
}

const fieldScratch: FieldVector = { x: 0, y: 0 };

export function sampleDipoleField(
  x: number,
  y: number,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
  softening: number,
  target: FieldVector = { x: 0, y: 0 },
): FieldVector {
  const leftDx = x - leftX;
  const leftDy = y - leftY;
  const leftDistanceSq = leftDx * leftDx + leftDy * leftDy + softening;
  const leftInv = 1 / (leftDistanceSq * Math.sqrt(leftDistanceSq));

  const rightDx = x - rightX;
  const rightDy = y - rightY;
  const rightDistanceSq = rightDx * rightDx + rightDy * rightDy + softening;
  const rightInv = -1 / (rightDistanceSq * Math.sqrt(rightDistanceSq));

  target.x = leftDx * leftInv + rightDx * rightInv;
  target.y = leftDy * leftInv + rightDy * rightInv;

  return target;
}

function traceFieldLine(
  ctx: CanvasRenderingContext2D,
  p: FlowFieldPatternContext,
  startX: number,
  startY: number,
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
  steps: number,
  stepSize: number,
  direction: number,
): void {
  let x = startX;
  let y = startY;
  const pad = 28;

  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let step = 0; step < steps; step++) {
    sampleDipoleField(
      x,
      y,
      leftX,
      leftY,
      rightX,
      rightY,
      240,
      fieldScratch,
    );

    const magnitude = p.fastSqrt(
      fieldScratch.x * fieldScratch.x + fieldScratch.y * fieldScratch.y,
    );
    if (!Number.isFinite(magnitude) || magnitude < 0.000001) {
      break;
    }

    x += (fieldScratch.x / magnitude) * stepSize * direction;
    y += (fieldScratch.y / magnitude) * stepSize * direction;

    if (x < -pad || x > p.width + pad || y < -pad || y > p.height + pad) {
      break;
    }

    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

export function renderMagneticFieldLines(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.74 : 1.02),
  );
  const minDimension = Math.min(p.width, p.height);
  const time = p.time * 0.0014;
  const seedsPerPole = Math.max(
    9,
    Math.min(18, Math.round(10 + detailScale * 5 + bassIntensity * 4)),
  );
  const steps = Math.max(
    20,
    Math.min(52, Math.round(24 + detailScale * 20 + trebleIntensity * 6)),
  );
  const stepSize =
    minDimension * (0.009 + detailScale * 0.0025 + trebleIntensity * 0.0015);
  const spread = minDimension * (0.14 + bassIntensity * 0.05);
  const rise = minDimension * (0.03 + audioIntensity * 0.04);
  const leftX = p.centerX - spread + p.fastSin(time * 0.81) * minDimension * 0.05;
  const rightX =
    p.centerX + spread + p.fastCos(time * 0.74) * minDimension * 0.05;
  const leftY = p.centerY + p.fastCos(time * 1.04) * rise;
  const rightY = p.centerY - p.fastSin(time * 0.93) * rise;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let pole = 0; pole < 2; pole++) {
    const poleX = pole === 0 ? leftX : rightX;
    const poleY = pole === 0 ? leftY : rightY;
    const hueOffset = pole === 0 ? 26 : 206;

    for (let i = 0; i < seedsPerPole; i++) {
      const angle = (i / seedsPerPole) * p.TWO_PI + time * (pole === 0 ? 0.34 : -0.31);
      const seedRadius = 16 + bassIntensity * 18 + (i % 3) * 5;
      const seedX = poleX + p.fastCos(angle) * seedRadius;
      const seedY = poleY + p.fastSin(angle) * seedRadius;
      const hue = p.fastMod360(p.hueBase + hueOffset + i * 14 + time * 40);

      ctx.strokeStyle = p.hsla(
        hue,
        100,
        70 + (i % 4) * 2,
        0.05 + audioIntensity * 0.08,
      );
      ctx.lineWidth = 0.85 + (i % 4) * 0.25 + trebleIntensity * 1.15;
      traceFieldLine(
        ctx,
        p,
        seedX,
        seedY,
        leftX,
        leftY,
        rightX,
        rightY,
        steps,
        stepSize,
        1,
      );
      traceFieldLine(
        ctx,
        p,
        seedX,
        seedY,
        leftX,
        leftY,
        rightX,
        rightY,
        steps,
        stepSize,
        -1,
      );
    }
  }

  const poleRadius = 12 + bassIntensity * 18;
  const leftGlow = ctx.createRadialGradient(leftX, leftY, 0, leftX, leftY, poleRadius);
  leftGlow.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 18), 100, 86, 0.28));
  leftGlow.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 42), 100, 44, 0));
  ctx.fillStyle = leftGlow;
  ctx.beginPath();
  ctx.arc(leftX, leftY, poleRadius, 0, p.TWO_PI);
  ctx.fill();

  const rightGlow = ctx.createRadialGradient(
    rightX,
    rightY,
    0,
    rightX,
    rightY,
    poleRadius,
  );
  rightGlow.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 206), 100, 86, 0.28));
  rightGlow.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 232), 100, 44, 0));
  ctx.fillStyle = rightGlow;
  ctx.beginPath();
  ctx.arc(rightX, rightY, poleRadius, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
