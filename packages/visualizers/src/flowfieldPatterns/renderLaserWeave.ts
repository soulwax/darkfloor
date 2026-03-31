import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderLaserWeave(
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
  const energyBoost = p.isFirefox ? 1.08 : 1.18;
  const bandCount = Math.max(
    6,
    Math.min(16, (8 + detailScale * 5 + bassIntensity * 7) | 0),
  );
  const segmentCount = Math.max(
    14,
    Math.min(p.isFirefox ? 28 : 36, (18 + detailScale * 14) | 0),
  );
  const hotPointCount = Math.max(8, Math.min(26, (10 + detailScale * 9) | 0));
  const pulseColumnCount = Math.max(
    3,
    Math.min(8, (3 + detailScale * 3 + bassIntensity * 2) | 0),
  );
  const minDimension = Math.min(p.width, p.height);
  const spanX = p.width * 0.62;
  const spanY = minDimension * 0.72;
  const weaveAmplitude = minDimension * (0.022 + bassIntensity * 0.05);
  const slope = 0.16 + bassIntensity * 0.16;
  const time = p.time * 0.0021;
  const hueDrift = p.time * 0.06;
  const invSegments = 1 / segmentCount;
  const alphaBase = clamp(
    (0.16 + audioIntensity * 0.2) * energyBoost,
    0.12,
    0.48,
  );

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let family = 0; family < 2; family++) {
    const direction = (family & 1) === 0 ? 1 : -1;

    for (let band = 0; band < bandCount; band++) {
      const bandNorm = bandCount > 1 ? band / (bandCount - 1) : 0.5;
      const baseY = (bandNorm - 0.5) * spanY;
      const hue = p.fastMod360(
        p.hueBase + family * 140 + band * (260 / bandCount) + hueDrift,
      );

      ctx.strokeStyle = p.hsla(
        hue,
        100,
        70 + bandNorm * 8,
        clamp(alphaBase + bandNorm * 0.05, 0.1, 0.48),
      );
      ctx.lineWidth =
        1.4 +
        trebleIntensity * 2.8 +
        bassIntensity * 0.6 +
        (((band + family) & 1) === 0 ? 0 : 0.75);
      ctx.beginPath();

      for (let step = 0; step <= segmentCount; step++) {
        const t = step * invSegments;
        const x = (t - 0.5) * spanX * 2.2;
        const waveA =
          p.fastSin(t * p.TWO_PI * 2 + time * 2.8 + band * 0.33) *
          weaveAmplitude;
        const waveB =
          p.fastCos(
            t * p.TWO_PI * (4 + (family & 1)) - time * 1.7 + band * 0.19,
          ) *
          weaveAmplitude *
          0.42;
        const y = baseY + direction * x * slope + waveA + waveB;

        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }

  for (let pulse = 0; pulse < pulseColumnCount; pulse++) {
    const t = pulseColumnCount > 1 ? pulse / (pulseColumnCount - 1) - 0.5 : 0;
    const beamX =
      t * spanX * 1.9 +
      p.fastSin(time * 1.9 + pulse * 0.83) * weaveAmplitude * 1.6;
    const beamWidth = 3 + bassIntensity * 4 + pulse * 0.8;
    const beamHeight = spanY * 1.14;
    const beamHue = p.fastMod360(p.hueBase + 148 + pulse * 36 + hueDrift);

    ctx.fillStyle = p.hsla(beamHue, 100, 72, 0.05 + audioIntensity * 0.08);
    ctx.fillRect(
      beamX - beamWidth * 0.5,
      -beamHeight * 0.5,
      beamWidth,
      beamHeight,
    );
  }

  const hotPointSize = 2.3 + trebleIntensity * 3.2 + bassIntensity * 1.8;
  for (let i = 0; i < hotPointCount; i++) {
    const t = i / hotPointCount;
    const x = (t - 0.5) * spanX * 1.9;
    const y =
      p.fastSin(t * p.TWO_PI * 6 + time * 4.2) * weaveAmplitude * 1.3 +
      p.fastCos(t * p.TWO_PI * 3 - time * 2.3) * weaveAmplitude * 0.55;
    const hue = p.fastMod360(p.hueBase + 200 + i * 11 + hueDrift * 2);
    const size = hotPointSize + (((i + p.time) & 3) === 0 ? 1.2 : 0.4);

    ctx.fillStyle = p.hsla(hue, 100, 80, 0.24 + audioIntensity * 0.3);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }

  ctx.restore();
}
