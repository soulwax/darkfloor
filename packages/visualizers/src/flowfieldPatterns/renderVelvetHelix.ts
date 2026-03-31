import type { FlowFieldPatternContext } from "./types";

export function renderVelvetHelix(
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
  const braidCount = Math.max(
    3,
    Math.min(6, (3 + detailScale * 2 + bassIntensity * 3) | 0),
  );
  const steps = Math.max(
    28,
    Math.min(p.isFirefox ? 56 : 72, (32 + detailScale * 24) | 0),
  );
  const dustStride = p.isFirefox ? 10 : 7;
  const minDimension = Math.min(p.width, p.height);
  const verticalSpan = p.height * 0.82;
  const amplitude = p.width * (0.06 + bassIntensity * 0.04);
  const time = p.time * 0.0021;
  const invSteps = 1 / steps;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let braid = 0; braid < braidCount; braid++) {
    const lane = braidCount > 1 ? braid / (braidCount - 1) - 0.5 : 0;
    const laneWeight = 1 - Math.abs(lane);
    const phase = time * (0.78 + braid * 0.09) + braid * 0.86;
    const ribbonOffset = 10 + laneWeight * 18 + bassIntensity * 22;
    const xBuffer = new Float32Array(steps + 1);
    const yBuffer = new Float32Array(steps + 1);
    const twistBuffer = new Float32Array(steps + 1);

    for (let step = 0; step <= steps; step++) {
      const progress = step * invSteps;
      const y = (progress - 0.5) * verticalSpan;
      const baseX =
        lane * minDimension * 0.14 +
        p.fastSin(progress * p.TWO_PI * (1.8 + braid * 0.18) + phase) *
          amplitude +
        p.fastCos(progress * p.TWO_PI * 4.2 - phase * 1.3 + braid) *
          amplitude *
          0.32;
      const twist =
        p.fastSin(progress * p.TWO_PI * 2.8 - phase * 1.7) * ribbonOffset;

      xBuffer[step] = baseX;
      yBuffer[step] = y;
      twistBuffer[step] = twist;
    }

    for (let side = -1; side <= 1; side += 2) {
      const hue = p.fastMod360(
        p.hueBase +
          (side < 0 ? 182 : 242) +
          braid * (180 / braidCount) +
          p.time * 0.04,
      );

      ctx.strokeStyle = p.hsla(
        hue,
        100,
        68 + laneWeight * 12,
        0.12 + audioIntensity * 0.18,
      );
      ctx.lineWidth = 4 + laneWeight * 7 + bassIntensity * 4;
      ctx.beginPath();

      for (let step = 0; step <= steps; step++) {
        const x = (xBuffer[step] ?? 0) + (twistBuffer[step] ?? 0) * side * 0.55;
        const y = yBuffer[step] ?? 0;

        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 66),
        100,
        84,
        0.08 + trebleIntensity * 0.14,
      );
      ctx.lineWidth = 1.4 + laneWeight * 1.4;
      ctx.stroke();
    }

    for (let step = dustStride; step < steps; step += dustStride) {
      const leftX = (xBuffer[step] ?? 0) - (twistBuffer[step] ?? 0) * 0.55;
      const rightX = (xBuffer[step] ?? 0) + (twistBuffer[step] ?? 0) * 0.55;
      const y = yBuffer[step] ?? 0;
      const hue = p.fastMod360(p.hueBase + braid * 42 + step * 3);

      if (!p.isFirefox || (step / dustStride) % 2 === 0) {
        ctx.strokeStyle = p.hsla(hue, 100, 82, 0.06 + audioIntensity * 0.1);
        ctx.lineWidth = 1 + trebleIntensity * 0.8;
        ctx.beginPath();
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();
      }

      const dustSize =
        1.4 +
        audioIntensity * 1.6 +
        (((braid + step / dustStride) & 1) === 0 ? 0.6 : 0.2);
      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 84),
        100,
        84,
        0.14 + audioIntensity * 0.14,
      );
      ctx.fillRect(
        rightX - dustSize * 0.5,
        y - dustSize * 0.5,
        dustSize,
        dustSize,
      );
      ctx.fillRect(
        leftX - dustSize * 0.5,
        y - dustSize * 0.5,
        dustSize * 0.8,
        dustSize * 0.8,
      );
    }
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, minDimension * 0.18);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 22), 100, 84, 0.14));
  core.addColorStop(0.58, p.hsla(p.fastMod360(p.hueBase + 186), 96, 58, 0.05));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 248), 82, 28, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, minDimension * 0.18, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
