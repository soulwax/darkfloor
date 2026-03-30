import type { FlowFieldPatternContext } from "./types";

function sampleHaloRadius(
  p: FlowFieldPatternContext,
  angle: number,
  phase: number,
  lane: number,
  audioIntensity: number,
  trebleIntensity: number,
): number {
  const fold =
    p.fastSin(angle * (2.4 + lane * 0.14) + phase) * (0.11 + audioIntensity * 0.08);
  const shear =
    p.fastCos(angle * (5.2 - lane * 0.09) - phase * 1.3) *
    (0.06 + trebleIntensity * 0.08);
  const shimmer =
    p.fastSin(angle * 8.6 + phase * 1.7 + lane * 0.6) *
    (0.02 + trebleIntensity * 0.03);

  return 1 + fold + shear + shimmer;
}

export function renderSilkHalo(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = p.detailScale * (p.isFirefox ? 0.76 : 1);
  const ribbonCount = Math.max(
    4,
    Math.min(9, (4 + detailScale * 4 + bassIntensity * 4) | 0),
  );
  const steps = Math.max(48, Math.min(112, (56 + detailScale * 44) | 0));
  const nodeCount = Math.max(6, Math.min(14, (6 + detailScale * 5) | 0));
  const minDimension = Math.min(p.width, p.height);
  const time = p.time * 0.002;
  const invSteps = 1 / steps;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let ribbon = 0; ribbon < ribbonCount; ribbon++) {
    const lane = ribbonCount > 1 ? ribbon / (ribbonCount - 1) - 0.5 : 0;
    const laneWeight = 1 - Math.abs(lane);
    const baseRadius = minDimension * (0.16 + ribbon * 0.044);
    const phase = time * (0.78 + ribbon * 0.09) + ribbon * 0.94;
    const stretch = 0.52 + laneWeight * 0.18 + bassIntensity * 0.08;
    const rotation = phase * 0.26 + lane * 0.62;
    const hue = p.fastMod360(
      p.hueBase + 210 + ribbon * (260 / ribbonCount) + p.time * 0.05,
    );

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      70 + (((ribbon + 1) & 1) === 0 ? 0 : 5),
      0.1 + audioIntensity * 0.18,
    );
    ctx.lineWidth = 2.4 + laneWeight * 6 + bassIntensity * 3.5;
    ctx.beginPath();

    for (let step = 0; step <= steps; step++) {
      const progress = step * invSteps;
      const angle = progress * p.TWO_PI;
      const haloRadius =
        baseRadius *
        sampleHaloRadius(
          p,
          angle,
          phase,
          ribbon,
          audioIntensity,
          trebleIntensity,
        );
      const orbitX = p.fastCos(angle + rotation) * haloRadius;
      const orbitY =
        p.fastSin(angle - rotation * 0.6) * haloRadius * stretch +
        p.fastSin(angle * 3.4 - phase * 1.4 + ribbon) *
          minDimension *
          (0.015 + trebleIntensity * 0.02);

      if (step === 0) {
        ctx.moveTo(orbitX, orbitY);
      } else {
        ctx.lineTo(orbitX, orbitY);
      }
    }

    ctx.stroke();

    ctx.strokeStyle = p.hsla(
      p.fastMod360(hue + 84),
      100,
      84,
      0.05 + trebleIntensity * 0.14,
    );
    ctx.lineWidth = 0.9 + laneWeight * 1.4;
    ctx.stroke();
  }

  for (let node = 0; node < nodeCount; node++) {
    const orbit = (node / nodeCount) * p.TWO_PI + time * (0.7 + node * 0.03);
    const radius = minDimension * (0.21 + ((node % 4) * 0.045));
    const x =
      p.fastCos(orbit) * radius +
      p.fastSin(node * 0.74 + time * 1.4) * minDimension * 0.018;
    const y =
      p.fastSin(orbit * 1.08) * radius * 0.66 +
      p.fastCos(node * 0.51 - time * 1.1) * minDimension * 0.022;
    const size =
      1.8 +
      bassIntensity * 1.8 +
      (((node + ribbonCount) & 1) === 0 ? 0.8 : 0.25);
    const hue = p.fastMod360(p.hueBase + 40 + node * 18);

    ctx.fillStyle = p.hsla(hue, 100, 82, 0.16 + audioIntensity * 0.16);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, minDimension * 0.24);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 28), 100, 84, 0.12));
  core.addColorStop(0.5, p.hsla(p.fastMod360(p.hueBase + 180), 96, 54, 0.05));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 250), 80, 30, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, minDimension * 0.24, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
