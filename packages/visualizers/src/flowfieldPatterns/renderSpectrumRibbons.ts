import type { FlowFieldPatternContext } from "./types";

function sampleRibbon(
  p: FlowFieldPatternContext,
  xNorm: number,
  phase: number,
  lane: number,
  freqA: number,
  freqB: number,
  amplitude: number,
  trebleIntensity: number,
): number {
  const waveA = p.fastSin(xNorm * p.TWO_PI * freqA + phase) * amplitude;
  const waveB =
    p.fastCos(xNorm * p.TWO_PI * freqB - phase * 1.4 + lane * 5.2) *
    amplitude *
    0.42;
  const waveC =
    p.fastSin((xNorm + lane * 0.25) * p.TWO_PI * 8 - phase * 2.1) *
    amplitude *
    (0.08 + trebleIntensity * 0.16);

  return waveA + waveB + waveC;
}

export function renderSpectrumRibbons(
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
  const ribbonCount = Math.max(
    4,
    Math.min(10, (5 + bassIntensity * 6 + detailScale * 3) | 0),
  );
  const steps = Math.max(
    20,
    Math.min(p.isFirefox ? 40 : 56, (26 + detailScale * 20) | 0),
  );
  const sparkCount = Math.max(4, Math.min(12, (4 + detailScale * 5) | 0));
  const sparkStride = p.isFirefox ? 2 : 1;
  const verticalSpan = p.height * 0.5;
  const amplitude = p.height * (0.03 + bassIntensity * 0.09);
  const time = p.time * 0.002;
  const invSteps = 1 / steps;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 0; i < ribbonCount; i++) {
    const lane = ribbonCount > 1 ? i / (ribbonCount - 1) - 0.5 : 0;
    const laneWeight = 1 - Math.abs(lane);
    const baseY = p.centerY + lane * verticalSpan;
    const freqA = 1.4 + (i & 3) * 0.55;
    const freqB = 3.2 + (i & 1) * 1.25;
    const phase = time * (1.1 + i * 0.08) + i * 0.62;
    const hue = p.fastMod360(
      p.hueBase + 25 + i * (300 / ribbonCount) + p.time * 0.05,
    );
    const sampleBuffer = new Float32Array(steps + 1);

    for (let step = 0; step <= steps; step++) {
      const xNorm = step * invSteps;
      sampleBuffer[step] = sampleRibbon(
        p,
        xNorm,
        phase,
        lane,
        freqA,
        freqB,
        amplitude,
        trebleIntensity,
      );
    }

    const fillOffset =
      (lane < 0 ? -1 : 1) * (14 + laneWeight * 18 + bassIntensity * 20);

    ctx.fillStyle = p.hsla(
      p.fastMod360(hue + 16),
      100,
      56 + laneWeight * 14,
      0.05 + audioIntensity * 0.14,
    );
    ctx.beginPath();
    for (let step = 0; step <= steps; step++) {
      const x = step * invSteps * p.width;
      const y = baseY + sampleBuffer[step]!;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    for (let step = steps; step >= 0; step--) {
      const x = step * invSteps * p.width;
      const y = baseY + sampleBuffer[step]! + fillOffset;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      66 + laneWeight * 10 + ((i & 1) === 0 ? 0 : 6),
      0.18 + audioIntensity * 0.24,
    );
    ctx.lineWidth = 6.5 + laneWeight * 11 + bassIntensity * 9;
    ctx.beginPath();

    for (let step = 0; step <= steps; step++) {
      const x = step * invSteps * p.width;
      const y = baseY + sampleBuffer[step]!;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    ctx.strokeStyle = p.hsla(
      p.fastMod360(hue + 56),
      100,
      84,
      0.1 + audioIntensity * 0.2,
    );
    ctx.lineWidth = 1.6 + trebleIntensity * 2.1;
    ctx.beginPath();

    for (let step = 0; step <= steps; step++) {
      const x = step * invSteps * p.width;
      const y = baseY + sampleBuffer[step]! - (2.2 + laneWeight * 2.4);

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    for (let spark = 0; spark < sparkCount; spark += sparkStride) {
      const xNorm = (((time * 0.21 + i * 0.13 + spark * 0.17) % 1) + 1) % 1;
      const sampleIndex = Math.min(steps, Math.round(xNorm * steps));
      const y = baseY + sampleBuffer[sampleIndex]!;
      const hueShift = p.fastMod360(hue + 120 + spark * 9);
      const size =
        1.6 + trebleIntensity * 1.8 + (((spark + i) & 1) === 0 ? 0.6 : 0.1);

      ctx.fillStyle = p.hsla(hueShift, 100, 82, 0.22 + audioIntensity * 0.24);
      ctx.fillRect(xNorm * p.width - size * 0.5, y - size * 0.5, size, size);
    }
  }

  ctx.restore();
}
