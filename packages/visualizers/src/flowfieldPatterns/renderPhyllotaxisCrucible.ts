import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const GOLDEN_ANGLE = 2.399963229728653;

export function renderPhyllotaxisCrucible(
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
  const seedCount = Math.max(
    72,
    Math.min(
      p.isFirefox ? 156 : 228,
      (84 + detailScale * 78 + bassIntensity * 48) | 0,
    ),
  );
  const ringCount = p.isFirefox ? 3 : 4;
  const tracerStride = p.isFirefox ? 9 : 6;
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.42;
  const coreRadius = minDimension * (0.08 + bassIntensity * 0.035);
  const time = p.time * 0.0019;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius * 1.1);
  aura.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 58), 100, 78, 0.14));
  aura.addColorStop(
    0.52,
    p.hsla(p.fastMod360(p.hueBase + 134), 92, 48, 0.05 + audioIntensity * 0.06),
  );
  aura.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 188), 80, 22, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius * 1.08, 0, p.TWO_PI);
  ctx.fill();

  for (let ring = 0; ring < ringCount; ring++) {
    const progress = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const radius = maxRadius * (0.24 + progress * 0.2);
    const hue = p.fastMod360(p.hueBase + 44 + ring * 34 + p.time * 0.03);

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      72 + progress * 8,
      0.08 + audioIntensity * 0.1,
    );
    ctx.lineWidth = 1.2 + (1 - progress) * 0.8 + trebleIntensity * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, p.TWO_PI);
    ctx.stroke();
  }

  for (let seed = 0; seed < seedCount; seed++) {
    const progress = (seed + 1) / seedCount;
    const angle =
      seed * GOLDEN_ANGLE +
      time * (0.42 + progress * 0.2) +
      p.fastSin(seed * 0.19 + time * 1.4) * 0.06;
    const radius =
      p.fastSqrt(progress) *
      maxRadius *
      (0.28 + 0.72 * (1 + bassIntensity * 0.06));
    const jitter = p.fastSin(seed * 0.37 + time * 2.1) * minDimension * 0.004;
    const x = p.fastCos(angle) * (radius + jitter);
    const y =
      p.fastSin(angle) * (radius * 0.92 + jitter * 0.5) -
      progress * coreRadius * 0.28;
    const hue = p.fastMod360(
      p.hueBase + 34 + progress * 170 + p.fastSin(seed * 0.11 + time) * 20,
    );
    const size =
      1.2 +
      (1 - progress) * (2.6 + bassIntensity * 2) +
      (((seed + ringCount) & 1) === 0 ? 0.6 : 0.2);

    ctx.fillStyle = p.hsla(
      hue,
      100,
      58 + (1 - progress) * 24,
      0.12 + audioIntensity * 0.12,
    );
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);

    if (!p.isFirefox && seed % tracerStride === 0) {
      const innerRadius = radius * 0.74;
      const innerX = p.fastCos(angle - 0.05) * innerRadius;
      const innerY = p.fastSin(angle - 0.05) * innerRadius * 0.92;
      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 74),
        100,
        82,
        clamp(0.04 + audioIntensity * 0.08, 0.04, 0.16),
      );
      ctx.lineWidth = 0.8 + trebleIntensity * 0.5;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = p.hsla(
    p.fastMod360(p.hueBase + 216),
    100,
    86,
    0.18 + audioIntensity * 0.14,
  );
  ctx.lineWidth = 1.4 + trebleIntensity * 1;
  ctx.beginPath();
  ctx.arc(
    0,
    coreRadius * 0.18,
    coreRadius * 1.18,
    Math.PI * 0.08,
    Math.PI * 0.92,
  );
  ctx.stroke();

  ctx.fillStyle = p.hsla(
    p.fastMod360(p.hueBase + 188),
    100,
    84,
    0.24 + audioIntensity * 0.12,
  );
  ctx.fillRect(-coreRadius * 0.8, -1.4, coreRadius * 1.6, 2.8);
  ctx.fillRect(-1.4, -coreRadius * 0.8, 2.8, coreRadius * 1.6);

  ctx.restore();
}
