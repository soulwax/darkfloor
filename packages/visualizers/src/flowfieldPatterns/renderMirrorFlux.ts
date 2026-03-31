import type { FlowFieldPatternContext } from "./types";

function sampleMirrorWave(
  p: FlowFieldPatternContext,
  progress: number,
  phase: number,
  lane: number,
  amplitude: number,
  trebleIntensity: number,
): number {
  const waveA = p.fastSin(progress * p.TWO_PI * 1.8 + phase) * amplitude;
  const waveB =
    p.fastCos(progress * p.TWO_PI * 4.6 - phase * 1.35 + lane * 4.8) *
    amplitude *
    0.36;
  const waveC =
    p.fastSin((progress + lane * 0.18) * p.TWO_PI * 7.4 - phase * 2.05) *
    amplitude *
    (0.08 + trebleIntensity * 0.15);

  return waveA + waveB + waveC;
}

export function renderMirrorFlux(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.72 : 1.06),
  );
  const laneCount = Math.max(
    4,
    Math.min(10, (4 + detailScale * 4 + bassIntensity * 6) | 0),
  );
  const steps = Math.max(
    18,
    Math.min(p.isFirefox ? 40 : 48, (20 + detailScale * 20) | 0),
  );
  const shardCount = Math.max(4, Math.min(14, (5 + detailScale * 6) | 0));
  const halfWidth = p.width * 0.48;
  const verticalSpan = p.height * 0.42;
  const amplitude = p.height * (0.032 + bassIntensity * 0.095);
  const time = p.time * 0.0022;
  const invSteps = 1 / steps;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const lane = laneCount > 1 ? laneIndex / (laneCount - 1) - 0.5 : 0;
    const laneWeight = 1 - Math.abs(lane);
    const baseY = lane * verticalSpan;
    const phase = time * (1.16 + laneIndex * 0.07) + laneIndex * 0.91;
    const hue = p.fastMod360(
      p.hueBase + laneIndex * (300 / laneCount) + p.time * 0.05,
    );
    const sampleBuffer = new Float32Array(steps + 1);
    const sideBiasBuffer = new Float32Array(steps + 1);

    for (let step = 0; step <= steps; step++) {
      const progress = step * invSteps;
      sampleBuffer[step] = sampleMirrorWave(
        p,
        progress,
        phase,
        lane,
        amplitude,
        trebleIntensity,
      );
      sideBiasBuffer[step] =
        p.fastCos(progress * p.TWO_PI * 3.4 + phase) * amplitude * 0.04;
    }

    for (let side = -1; side <= 1; side += 2) {
      const fillOffset = side * (1.5 + laneWeight * 2.6 + bassIntensity * 2.8);
      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + (side < 0 ? 36 : 0)),
        100,
        54 + laneWeight * 12,
        0.04 + audioIntensity * 0.12,
      );
      ctx.beginPath();
      for (let step = 0; step <= steps; step++) {
        const progress = step * invSteps;
        const x = progress * halfWidth * side;
        const y = baseY + sampleBuffer[step]! + side * sideBiasBuffer[step]!;

        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      for (let step = steps; step >= 0; step--) {
        const progress = step * invSteps;
        const x = progress * halfWidth * side;
        const y =
          baseY +
          sampleBuffer[step]! +
          side * sideBiasBuffer[step]! +
          fillOffset;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = p.hsla(
        side < 0 ? p.fastMod360(hue + 44) : hue,
        100,
        70 + laneWeight * 8 + (((laneIndex + side) & 1) === 0 ? 0 : 5),
        0.17 + audioIntensity * 0.22,
      );
      ctx.lineWidth = 2.6 + laneWeight * 5.4 + bassIntensity * 4.8;
      ctx.beginPath();

      for (let step = 0; step <= steps; step++) {
        const progress = step * invSteps;
        const x = progress * halfWidth * side;
        const y = baseY + sampleBuffer[step]! + side * sideBiasBuffer[step]!;

        if (step === 0) {
          ctx.moveTo(0, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 110 + (side < 0 ? 18 : 0)),
        100,
        84,
        0.1 + audioIntensity * 0.2,
      );
      ctx.lineWidth = 1.3 + trebleIntensity * 1.8;
      ctx.beginPath();

      for (let step = 0; step <= steps; step++) {
        const progress = step * invSteps;
        const x = progress * halfWidth * side;
        const y =
          baseY +
          sampleBuffer[step]! +
          side * sideBiasBuffer[step]! -
          (1.8 + laneWeight * 2.1);

        if (step === 0) {
          ctx.moveTo(0, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    for (let shard = 0; shard < shardCount; shard++) {
      const progress =
        (((time * 0.23 + laneIndex * 0.11 + shard * 0.17) % 1) + 1) % 1;
      const x = progress * halfWidth;
      const y =
        baseY + sampleBuffer[Math.min(steps, Math.round(progress * steps))]!;
      const size =
        1.6 +
        trebleIntensity * 2 +
        (((laneIndex + shard) & 1) === 0 ? 0.7 : 0.2);
      const hueShift = p.fastMod360(hue + 150 + shard * 14);

      ctx.fillStyle = p.hsla(hueShift, 100, 82, 0.22 + audioIntensity * 0.24);
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
      ctx.fillRect(-x - size * 0.5, y - size * 0.5, size, size);
    }
  }

  const coreWidth = 20 + bassIntensity * 28;
  const coreHeight = 2.6 + trebleIntensity * 1.6;
  ctx.fillStyle = p.hsla(p.fastMod360(p.hueBase + 210), 100, 86, 0.28);
  ctx.fillRect(-coreWidth * 0.5, -coreHeight * 0.5, coreWidth, coreHeight);
  ctx.fillRect(-coreHeight * 0.5, -coreWidth * 0.5, coreHeight, coreWidth);

  ctx.restore();
}
