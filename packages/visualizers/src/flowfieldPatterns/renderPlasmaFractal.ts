import type { FlowFieldPatternContext } from "./types";

function hashNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function renderPlasmaFractal(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const step = Math.max(8, (18 - trebleIntensity * 6) | 0);
  const time = p.time * 0.0011;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let y = 0; y < p.height; y += step) {
    for (let x = 0; x < p.width; x += step) {
      const nx = (x - p.centerX) / p.width;
      const ny = (y - p.centerY) / p.height;
      const v1 = p.fastSin((nx * 7 + time * 1.9) * Math.PI);
      const v2 = p.fastCos((ny * 8 - time * 1.5) * Math.PI);
      const v3 = p.fastSin((nx + ny) * 13 + time * 4.2);
      const grain = hashNoise(x * 0.05 + time * 8, y * 0.05 - time * 6) - 0.5;
      const plasma = (v1 + v2 + v3) * 0.25 + grain * (0.35 + bassIntensity * 0.2);
      const hue = p.fastMod360(p.hueBase + 220 + plasma * 150 + time * 60);
      const alpha = 0.08 + audioIntensity * 0.12 + Math.abs(plasma) * 0.08;

      ctx.fillStyle = p.hsla(hue, 92, 56 + plasma * 18, alpha);
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }

  ctx.restore();
}
