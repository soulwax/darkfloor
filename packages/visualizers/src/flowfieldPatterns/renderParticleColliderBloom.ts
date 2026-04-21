import type { FlowFieldPatternContext } from "./types";

export function colliderBurstEnvelope(progress: number): number {
  const wrapped = ((progress % 1) + 1) % 1;
  if (wrapped <= 0.5) {
    return Math.pow(wrapped * 2, 1.35);
  }

  return Math.pow((1 - wrapped) * 2, 1.6);
}

export function renderParticleColliderBloom(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.7 : 1.04),
  );
  const minDimension = Math.min(p.width, p.height);
  const time = p.time * 0.00125;
  const envelope = colliderBurstEnvelope(time * 0.22);
  const jetCount = Math.max(
    14,
    Math.min(34, Math.round(16 + detailScale * 10 + bassIntensity * 8)),
  );
  const shellCount = p.isFirefox ? 3 : 5;
  const coreRadius =
    minDimension * (0.05 + envelope * 0.03 + bassIntensity * 0.035);
  const beamSpan = minDimension * (0.42 + audioIntensity * 0.08);

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const leftBeam = ctx.createLinearGradient(-beamSpan, 0, 0, 0);
  leftBeam.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 194), 100, 48, 0));
  leftBeam.addColorStop(0.5, p.hsla(p.fastMod360(p.hueBase + 212), 100, 66, 0.16));
  leftBeam.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 34), 100, 86, 0.32));
  ctx.strokeStyle = leftBeam;
  ctx.lineWidth = 4 + bassIntensity * 6 + envelope * 3;
  ctx.beginPath();
  ctx.moveTo(-beamSpan, 0);
  ctx.lineTo(-coreRadius * 0.25, 0);
  ctx.stroke();

  const rightBeam = ctx.createLinearGradient(0, 0, beamSpan, 0);
  rightBeam.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 18), 100, 86, 0.32));
  rightBeam.addColorStop(0.5, p.hsla(p.fastMod360(p.hueBase + 332), 100, 66, 0.16));
  rightBeam.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 320), 100, 48, 0));
  ctx.strokeStyle = rightBeam;
  ctx.beginPath();
  ctx.moveTo(coreRadius * 0.25, 0);
  ctx.lineTo(beamSpan, 0);
  ctx.stroke();

  for (let shell = 0; shell < shellCount; shell++) {
    const shellProgress = shell / (shellCount - 1);
    const radius =
      coreRadius * (0.95 + shellProgress * 1.9) +
      envelope * minDimension * 0.012 * (shell + 1);
    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + 40 + shell * 24),
      100,
      74 - shellProgress * 14,
      0.06 + (1 - shellProgress) * 0.12 + audioIntensity * 0.05,
    );
    ctx.lineWidth = 1.2 + (1 - shellProgress) * 2 + trebleIntensity * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, p.TWO_PI);
    ctx.stroke();
  }

  for (let jet = 0; jet < jetCount; jet++) {
    const jetProgress = jet / jetCount;
    const cycle = colliderBurstEnvelope(time * 0.34 + jetProgress * 0.8);
    const angle = jetProgress * p.TWO_PI + time * 0.43;
    const length =
      minDimension * (0.12 + cycle * 0.24 + trebleIntensity * 0.08);
    const controlLength = length * (0.42 + bassIntensity * 0.08);
    const bend =
      p.fastSin(time * 3.3 + jet * 0.71) * minDimension * 0.024 * (1 + audioIntensity);
    const hue = p.fastMod360(p.hueBase + jet * (360 / jetCount) + time * 54);
    const startRadius = coreRadius * (0.25 + cycle * 0.18);

    const startX = p.fastCos(angle) * startRadius;
    const startY = p.fastSin(angle) * startRadius;
    const endX = p.fastCos(angle) * length;
    const endY = p.fastSin(angle) * length;
    const controlX = p.fastCos(angle) * controlLength - p.fastSin(angle) * bend;
    const controlY = p.fastSin(angle) * controlLength + p.fastCos(angle) * bend;

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      68 + cycle * 18,
      0.06 + cycle * 0.14 + audioIntensity * 0.05,
    );
    ctx.lineWidth = 1 + cycle * 2.6 + trebleIntensity * 1.1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();

    const sparkSize = 1 + cycle * 2 + bassIntensity * 0.6;
    ctx.fillStyle = p.hsla(
      p.fastMod360(hue + 26),
      100,
      82,
      0.09 + cycle * 0.18 + trebleIntensity * 0.05,
    );
    ctx.fillRect(
      endX - sparkSize * 0.5,
      endY - sparkSize * 0.5,
      sparkSize,
      sparkSize,
    );
  }

  const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 2.8);
  coreGlow.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 48), 100, 92, 0.34));
  coreGlow.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 210), 100, 38, 0));
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 2.8, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
