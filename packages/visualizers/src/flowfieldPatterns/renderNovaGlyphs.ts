import type { FlowFieldPatternContext } from "./types";

export function renderNovaGlyphs(
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
  const armCount = Math.max(
    10,
    Math.min(28, (12 + detailScale * 8 + bassIntensity * 9) | 0),
  );
  const ringCount = p.isFirefox ? 2 : 4;
  const nodeCount = p.isFirefox ? 2 : 4;
  const minDimension = Math.min(p.width, p.height);
  const maxRadius = minDimension * 0.46;
  const time = p.time * 0.0024;

  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let ring = 0; ring < ringCount; ring++) {
    const ringRadius =
      maxRadius * (0.3 + ring * 0.18) * (1 + bassIntensity * 0.08);
    const spin = time * (0.82 + ring * 0.26);
    const armStep = p.TWO_PI / armCount;

    for (let arm = 0; arm < armCount; arm++) {
      const angle =
        arm * armStep +
        spin +
        p.fastSin(arm * 0.41 + time * 1.9 + ring * 0.6) * 0.12;
      const innerRadius = ringRadius * (0.12 + ring * 0.05);
      const outerRadius =
        ringRadius *
        (0.48 +
          audioIntensity * 0.34 +
          p.fastCos(arm * 0.33 - time * 2.3 + ring) * 0.12);
      const x1 = p.fastCos(angle) * innerRadius;
      const y1 = p.fastSin(angle) * innerRadius;
      const x2 = p.fastCos(angle) * outerRadius;
      const y2 = p.fastSin(angle) * outerRadius;
      const hue = p.fastMod360(
        p.hueBase + p.time * 0.07 + ring * 90 + arm * (520 / armCount),
      );

      ctx.strokeStyle = p.hsla(
        hue,
        100,
        72 + (((ring + arm) & 1) === 0 ? 0 : 6),
        0.14 + audioIntensity * 0.22,
      );
      ctx.lineWidth = 1.3 + trebleIntensity * 2 + (ring & 1) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      for (let node = 0; node < nodeCount; node++) {
        const progress = (node + 1) / (nodeCount + 1);
        const x = x1 + (x2 - x1) * progress;
        const y = y1 + (y2 - y1) * progress;
        const size =
          1.7 +
          (1 - progress) * (2.2 + bassIntensity * 1.8) +
          (((arm + node) & 1) === 0 ? 0.6 : 0.15);

        ctx.fillStyle = p.hsla(
          p.fastMod360(hue + node * 26),
          100,
          82 - progress * 10,
          0.18 + audioIntensity * 0.18,
        );
        ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
      }

      if (!p.isFirefox || ((arm + ring) & 1) === 0) {
        const tipSize = 1.8 + bassIntensity * 1.8 + (ring & 1) * 0.5;
        ctx.fillStyle = p.hsla(
          p.fastMod360(hue + 64),
          100,
          86,
          0.16 + audioIntensity * 0.18,
        );
        ctx.fillRect(x2 - tipSize * 0.5, y2 - tipSize * 0.5, tipSize, tipSize);
      }
    }
  }

  const glyphCount = Math.max(8, Math.min(20, (armCount * 0.72) | 0));
  const glyphStep = p.TWO_PI / glyphCount;
  const glyphRadius = maxRadius * 0.86;

  for (let glyph = 0; glyph < glyphCount; glyph++) {
    const angle =
      glyph * glyphStep -
      time * 0.66 +
      p.fastCos(glyph * 0.39 + time * 1.4) * 0.08;
    const x = p.fastCos(angle) * glyphRadius;
    const y = p.fastSin(angle) * glyphRadius;
    const size =
      2.4 + bassIntensity * 2.4 + (((glyph + ringCount) & 1) === 0 ? 0.8 : 0.2);
    const hue = p.fastMod360(p.hueBase + glyph * (360 / glyphCount) + 180);

    ctx.fillStyle = p.hsla(hue, 100, 84, 0.2 + audioIntensity * 0.18);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
    ctx.fillRect(-x - size * 0.35, y - size * 0.35, size * 0.7, size * 0.7);
  }

  const coreWidth = 14 + bassIntensity * 26;
  const coreBar = 2.3 + trebleIntensity * 1.5;
  ctx.fillStyle = p.hsla(p.fastMod360(p.hueBase + 230), 100, 88, 0.28);
  ctx.fillRect(-coreWidth * 0.5, -coreBar * 0.5, coreWidth, coreBar);
  ctx.fillRect(-coreBar * 0.5, -coreWidth * 0.5, coreBar, coreWidth);
  ctx.fillRect(
    -coreWidth * 0.22,
    -coreWidth * 0.22,
    coreWidth * 0.44,
    coreWidth * 0.44,
  );

  ctx.restore();
}
