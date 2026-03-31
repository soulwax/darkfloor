import type { FlowFieldPatternContext } from "./types";

interface CatalystNode {
  ring: number;
  slot: number;
  x: number;
  y: number;
  hue: number;
  size: number;
}

export function renderMycelialCatalyst(
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
  const ringCount = p.isFirefox ? 3 : 4;
  const baseNodesPerRing = Math.max(
    6,
    Math.min(12, (6 + detailScale * 3 + bassIntensity * 3) | 0),
  );
  const sporeCount = Math.max(
    14,
    Math.min(
      p.isFirefox ? 28 : 44,
      (16 + detailScale * 12 + trebleIntensity * 8) | 0,
    ),
  );
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.42;
  const time = p.time * 0.0019;
  const nodes: CatalystNode[] = [];

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let ring = 0; ring < ringCount; ring++) {
    const ringProgress = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const nodesInRing = baseNodesPerRing + ring * 2;
    const radius = maxRadius * (0.22 + ringProgress * 0.24);

    for (let slot = 0; slot < nodesInRing; slot++) {
      const angle =
        (slot / nodesInRing) * p.TWO_PI +
        time * (0.28 + ring * 0.08) +
        p.fastSin(slot * 0.43 + ring * 0.8 + time * 1.6) * 0.08;
      const localRadius =
        radius + p.fastCos(slot * 0.37 - time * 1.7) * maxRadius * 0.02;
      const x = p.fastCos(angle) * localRadius;
      const y = p.fastSin(angle) * localRadius * (0.88 + ringProgress * 0.08);
      const hue = p.fastMod360(
        p.hueBase + 96 + ring * 34 + slot * (220 / nodesInRing),
      );

      nodes.push({
        ring,
        slot,
        x,
        y,
        hue,
        size:
          1.6 +
          (1 - ringProgress) * 1.6 +
          bassIntensity * 1.4 +
          ((slot & 1) === 0 ? 0.4 : 0.1),
      });
    }
  }

  for (const node of nodes) {
    const nextRing = node.ring + 1;
    if (nextRing >= ringCount) continue;

    const targets = nodes.filter(
      (candidate) =>
        candidate.ring === nextRing &&
        (candidate.slot ===
          (node.slot * 2) % (baseNodesPerRing + nextRing * 2) ||
          candidate.slot ===
            (node.slot * 2 + 1) % (baseNodesPerRing + nextRing * 2)),
    );

    for (const target of targets) {
      ctx.strokeStyle = p.hsla(
        p.fastMod360((node.hue + target.hue) * 0.5 + 24),
        100,
        74,
        0.06 + audioIntensity * 0.1,
      );
      ctx.lineWidth =
        0.9 +
        (1 - node.ring / Math.max(1, ringCount - 1)) * 1 +
        trebleIntensity * 0.6;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.quadraticCurveTo(
        (node.x + target.x) * 0.5 + p.fastSin(node.slot + time * 2) * 8,
        (node.y + target.y) * 0.5 + p.fastCos(target.slot + time * 1.8) * 8,
        target.x,
        target.y,
      );
      ctx.stroke();
    }
  }

  for (const node of nodes) {
    ctx.fillStyle = p.hsla(node.hue, 100, 80, 0.16 + audioIntensity * 0.14);
    ctx.fillRect(
      node.x - node.size * 0.5,
      node.y - node.size * 0.5,
      node.size,
      node.size,
    );
  }

  for (let spore = 0; spore < sporeCount; spore++) {
    const orbit =
      (spore / sporeCount) * p.TWO_PI -
      time * (0.34 + spore * 0.006) +
      p.fastSin(spore * 0.47 + time * 1.7) * 0.14;
    const radius =
      maxRadius * (0.24 + (spore % 5) * 0.11) +
      p.fastCos(spore * 0.39 + time * 2.2) * maxRadius * 0.04;
    const x = p.fastCos(orbit) * radius;
    const y = p.fastSin(orbit * 1.08) * radius * 0.86;
    const size =
      1.2 +
      audioIntensity * 1.2 +
      (((spore + ringCount) & 1) === 0 ? 0.5 : 0.15);

    ctx.fillStyle = p.hsla(
      p.fastMod360(p.hueBase + 168 + spore * 9),
      100,
      84,
      0.1 + trebleIntensity * 0.1,
    );
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius * 0.28);
  core.addColorStop(0, p.hsla(p.fastMod360(p.hueBase + 46), 100, 86, 0.14));
  core.addColorStop(0.6, p.hsla(p.fastMod360(p.hueBase + 118), 96, 56, 0.06));
  core.addColorStop(1, p.hsla(p.fastMod360(p.hueBase + 188), 82, 24, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius * 0.28, 0, p.TWO_PI);
  ctx.fill();

  ctx.restore();
}
