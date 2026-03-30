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
  const detailScale = p.detailScale * (p.isFirefox ? 0.76 : 1);
  const ribbonCount = Math.max(
    4,
    Math.min(9, (5 + bassIntensity * 6 + detailScale * 2) | 0),
  );
  const steps = Math.max(18, Math.min(48, (24 + detailScale * 18) | 0));
  const sparkCount = Math.max(4, Math.min(10, (4 + detailScale * 4) | 0));
  const sparkStride = p.isFirefox ? 2 : 1;
  const verticalSpan = p.height * 0.5;
  const amplitude = p.height * (0.026 + bassIntensity * 0.085);
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

    ctx.strokeStyle = p.hsla(
      hue,
      100,
      64 + ((i & 1) === 0 ? 0 : 6),
      0.16 + audioIntensity * 0.22,
    );
    ctx.lineWidth = 6 + laneWeight * 10 + bassIntensity * 8;
    ctx.beginPath();

    for (let step = 0; step <= steps; step++) {
      const xNorm = step * invSteps;
      const x = xNorm * p.width;
      const y =
        baseY +
        sampleRibbon(
          p,
          xNorm,
          phase,
          lane,
          freqA,
          freqB,
          amplitude,
          trebleIntensity,
        );

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
      0.08 + audioIntensity * 0.18,
    );
    ctx.lineWidth = 1.4 + trebleIntensity * 1.8;
    ctx.beginPath();

    for (let step = 0; step <= steps; step++) {
      const xNorm = step * invSteps;
      const x = xNorm * p.width;
      const y =
        baseY +
        sampleRibbon(
          p,
          xNorm,
          phase,
          lane,
          freqA,
          freqB,
          amplitude,
          trebleIntensity,
        ) -
        (2 + laneWeight * 2);

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    for (let spark = 0; spark < sparkCount; spark += sparkStride) {
      const xNorm = ((time * 0.21 + i * 0.13 + spark * 0.17) % 1 + 1) % 1;
      const y =
        baseY +
        sampleRibbon(
          p,
          xNorm,
          phase,
          lane,
          freqA,
          freqB,
          amplitude,
          trebleIntensity,
        );
      const hueShift = p.fastMod360(hue + 120 + spark * 9);
      const size =
        1.4 +
        trebleIntensity * 1.6 +
        (((spark + i) & 1) === 0 ? 0.6 : 0.1);

      ctx.fillStyle = p.hsla(hueShift, 100, 80, 0.2 + audioIntensity * 0.24);
      ctx.fillRect(xNorm * p.width - size * 0.5, y - size * 0.5, size, size);
    }
  }

  ctx.restore();
}
