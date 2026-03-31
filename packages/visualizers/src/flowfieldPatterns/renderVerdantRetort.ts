import type { FlowFieldPatternContext } from "./types";

export function renderVerdantRetort(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const detailScale = Math.max(
    0.72,
    p.detailScale * (p.isFirefox ? 0.7 : 1.05),
  );
  const retortCount = Math.max(
    3,
    Math.min(6, (3 + detailScale * 2 + bassIntensity * 2) | 0),
  );
  const frondCount = Math.max(
    4,
    Math.min(8, (4 + detailScale * 2 + trebleIntensity * 2) | 0),
  );
  const vaporCount = Math.max(
    10,
    Math.min(
      p.isFirefox ? 20 : 32,
      (12 + detailScale * 8 + bassIntensity * 6) | 0,
    ),
  );
  const stemSpacing = p.width / (retortCount + 1);
  const time = p.time * 0.0018;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let retort = 0; retort < retortCount; retort++) {
    const progress = retortCount > 1 ? retort / (retortCount - 1) : 0.5;
    const x =
      stemSpacing * (retort + 1) +
      p.fastSin(time * 1.2 + retort * 0.74) * stemSpacing * 0.08;
    const baseY = p.height * 0.84;
    const stemHeight =
      p.height * (0.28 + (1 - Math.abs(progress - 0.5) * 1.2) * 0.18) +
      bassIntensity * p.height * 0.08;
    const flaskY = baseY - stemHeight;
    const flaskRadius = 16 + progress * 18 + bassIntensity * 20;
    const hue = p.fastMod360(p.hueBase + 78 + progress * 86 + retort * 18);

    ctx.fillStyle = p.hsla(
      p.fastMod360(hue + 34),
      100,
      66,
      0.04 + audioIntensity * 0.06,
    );
    ctx.fillRect(x - flaskRadius * 0.2, 0, flaskRadius * 0.4, p.height);

    ctx.strokeStyle = p.hsla(hue, 100, 72, 0.14 + audioIntensity * 0.14);
    ctx.lineWidth = 2 + bassIntensity * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, flaskY + flaskRadius * 0.7);
    ctx.stroke();

    ctx.fillStyle = p.hsla(
      p.fastMod360(hue + 18),
      100,
      56,
      0.08 + audioIntensity * 0.1,
    );
    ctx.beginPath();
    ctx.ellipse(x, flaskY, flaskRadius, flaskRadius * 0.76, 0, 0, p.TWO_PI);
    ctx.fill();

    ctx.strokeStyle = p.hsla(
      p.fastMod360(hue + 58),
      100,
      84,
      0.12 + audioIntensity * 0.12,
    );
    ctx.lineWidth = 1.2 + trebleIntensity * 0.8;
    ctx.beginPath();
    ctx.ellipse(x, flaskY, flaskRadius, flaskRadius * 0.76, 0, 0, p.TWO_PI);
    ctx.stroke();

    for (let frond = 0; frond < frondCount; frond++) {
      const attach = frondCount > 1 ? frond / (frondCount - 1) : 0.5;
      const attachY = baseY - stemHeight * (0.22 + attach * 0.62);
      const side = (frond & 1) === 0 ? -1 : 1;
      const span =
        stemSpacing * (0.16 + attach * 0.12) +
        p.fastSin(time * 1.7 + frond * 0.63 + retort) * stemSpacing * 0.04;
      const tipX = x + side * span;
      const tipY =
        attachY -
        stemSpacing * (0.08 + attach * 0.06) -
        p.fastCos(time * 1.3 + frond * 0.51) * stemSpacing * 0.025;
      const controlX = x + side * span * 0.48;
      const controlY = attachY - stemSpacing * 0.1;

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + side * 24 + frond * 8),
        100,
        70 + attach * 10,
        0.1 + audioIntensity * 0.12,
      );
      ctx.lineWidth = 1 + (1 - attach) * 1.2 + bassIntensity * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, attachY);
      ctx.quadraticCurveTo(controlX, controlY, tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = p.hsla(
        p.fastMod360(hue + 92),
        100,
        84,
        0.05 + trebleIntensity * 0.08,
      );
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x + side * span * 0.24, attachY - stemSpacing * 0.02);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    for (let vapor = retort; vapor < vaporCount; vapor += retortCount) {
      const travel =
        (((vapor / vaporCount + time * (0.12 + progress * 0.05)) % 1) + 1) % 1;
      const drift = p.fastSin(time * 2.1 + vapor * 0.68) * flaskRadius * 0.42;
      const vaporX =
        x + drift + p.fastCos(vapor * 0.37 + time * 1.8) * flaskRadius * 0.18;
      const vaporY =
        flaskY - travel * (stemSpacing * 0.9 + flaskRadius * 1.2) - vapor * 0.3;
      const size =
        1.4 +
        travel * 1.8 +
        (((vapor + retort) & 1) === 0 ? 0.4 : 0.1) +
        audioIntensity * 0.8;

      ctx.fillStyle = p.hsla(
        p.fastMod360(hue + 128 + vapor * 6),
        100,
        82,
        0.12 + audioIntensity * 0.12,
      );
      ctx.fillRect(vaporX - size * 0.5, vaporY - size * 0.5, size, size);
    }
  }

  ctx.restore();
}
