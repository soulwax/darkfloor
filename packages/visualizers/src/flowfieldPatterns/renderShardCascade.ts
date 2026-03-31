import type { FlowFieldPatternContext } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function renderShardCascade(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.7 : 1.06),
  );
  const laneCount = Math.max(
    6,
    Math.min(14, (7 + detailScale * 4 + bassIntensity * 4) | 0),
  );
  const shardCount = Math.max(
    18,
    Math.min(
      p.isFirefox ? 36 : 48,
      (22 + detailScale * 14 + bassIntensity * 16) | 0,
    ),
  );
  const sparkStride = p.isFirefox ? 3 : 2;
  const laneWidth = p.width / laneCount;
  const shardSpan = p.height / Math.max(8, (laneCount * 0.82) | 0);
  const time = p.time * 0.0018;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";

  for (let lane = 0; lane < laneCount; lane++) {
    const laneProgress = laneCount > 1 ? lane / (laneCount - 1) : 0.5;
    const laneCenter = lane * laneWidth + laneWidth * 0.5;
    const drift = p.fastSin(time * 1.6 + lane * 0.81) * laneWidth * 0.18;
    const beamWidth = laneWidth * (0.18 + bassIntensity * 0.08);
    const beamHue = p.fastMod360(p.hueBase + 160 + lane * (180 / laneCount));

    ctx.fillStyle = p.hsla(beamHue, 100, 68, 0.04 + audioIntensity * 0.08);
    ctx.fillRect(
      laneCenter + drift * 0.35 - beamWidth * 0.5,
      0,
      beamWidth,
      p.height,
    );

    for (let shard = lane & 1; shard < shardCount; shard += 2) {
      const travel =
        (((shard / shardCount +
          time * (0.08 + laneProgress * 0.04) +
          lane * 0.037) %
          1) +
          1) %
        1;
      const pulse =
        p.fastSin(travel * 11 - time * 4 + lane * 0.63 + shard * 0.21) * 0.5 +
        0.5;
      const centerX =
        laneCenter +
        drift +
        p.fastSin(time * 2.2 + shard * 0.48) * laneWidth * 0.12;
      const y = travel * (p.height + shardSpan * 2.2) - shardSpan * 1.1;
      const width = laneWidth * (0.24 + pulse * 0.18 + laneProgress * 0.06);
      const height = shardSpan * (0.34 + pulse * 0.32);
      const skew =
        width *
        (0.22 + trebleIntensity * 0.16) *
        (((lane + shard) & 1) === 0 ? -1 : 1);
      const hue = p.fastMod360(
        p.hueBase +
          lane * (240 / laneCount) +
          shard * (320 / shardCount) +
          pulse * 90,
      );

      ctx.fillStyle = p.hsla(
        hue,
        100,
        58 + pulse * 20,
        0.08 + pulse * 0.14 + audioIntensity * 0.1,
      );
      ctx.beginPath();
      ctx.moveTo(centerX - width * 0.5 - skew, y);
      ctx.lineTo(centerX + width * 0.5, y);
      ctx.lineTo(centerX + width * 0.5 + skew * 0.72, y + height);
      ctx.lineTo(centerX - width * 0.5, y + height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 42),
        100,
        84,
        0.12 + trebleIntensity * 0.12,
      );
      ctx.fillRect(centerX - width * 0.2, y, width * 0.08, height);
      ctx.fillRect(centerX + width * 0.12, y, width * 0.05, height);

      if (!p.isFirefox || pulse > 0.48) {
        ctx.strokeStyle = p.hsla(
          p.fastMod360(hue + 96),
          100,
          86,
          clamp(0.08 + pulse * 0.12, 0.08, 0.28),
        );
        ctx.lineWidth = 0.9 + pulse * 1.2;
        ctx.stroke();
      }

      if (pulse > 0.44 && shard % sparkStride === 0) {
        const sparkSize =
          1.6 + audioIntensity * 1.8 + (((lane + shard) & 1) === 0 ? 0.6 : 0.2);
        ctx.fillStyle = p.hsla(
          p.fastMod360(hue + 184),
          100,
          86,
          0.18 + audioIntensity * 0.16,
        );
        ctx.fillRect(
          centerX + width * 0.18 - sparkSize * 0.5,
          y + height * 0.22 - sparkSize * 0.5,
          sparkSize,
          sparkSize,
        );
      }
    }
  }

  ctx.restore();
}
