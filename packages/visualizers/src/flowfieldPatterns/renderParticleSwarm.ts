import type { FlowFieldPatternContext } from "./types";

interface SwarmPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
}

const swarmPoints: SwarmPoint[] = [];

export function renderParticleSwarm(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const targetCount = Math.max(48, Math.min(220, (90 + bassIntensity * 120) | 0));
  const maxSpeed = 1.6 + trebleIntensity * 1.6;
  const orbitPull = 0.003 + bassIntensity * 0.01;
  const noisePush = 0.02 + trebleIntensity * 0.035;

  while (swarmPoints.length < targetCount) {
    const angle = Math.random() * p.TWO_PI;
    const radius = Math.random() * Math.min(p.width, p.height) * 0.35;
    swarmPoints.push({
      x: p.centerX + Math.cos(angle) * radius,
      y: p.centerY + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      hue: Math.random() * 360,
    });
  }

  swarmPoints.length = targetCount;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < swarmPoints.length; i++) {
    const point = swarmPoints[i];
    if (!point) continue;

    const dx = p.centerX - point.x;
    const dy = p.centerY - point.y;
    const distance = Math.max(1, p.fastSqrt(dx * dx + dy * dy));
    const tangentX = -dy / distance;
    const tangentY = dx / distance;
    const pulse = p.fastSin(p.time * 0.0017 + i * 0.23);

    point.vx += tangentX * orbitPull * distance * 0.015;
    point.vy += tangentY * orbitPull * distance * 0.015;
    point.vx += (dx / distance) * orbitPull * 4;
    point.vy += (dy / distance) * orbitPull * 4;
    point.vx += p.fastSin(i * 1.7 + p.time * 0.002) * noisePush;
    point.vy += p.fastCos(i * 1.1 - p.time * 0.0017) * noisePush;

    const speed = p.fastSqrt(point.vx * point.vx + point.vy * point.vy);
    if (speed > maxSpeed) {
      point.vx = (point.vx / speed) * maxSpeed;
      point.vy = (point.vy / speed) * maxSpeed;
    }

    point.x += point.vx;
    point.y += point.vy;

    if (point.x < 0) point.x += p.width;
    if (point.x > p.width) point.x -= p.width;
    if (point.y < 0) point.y += p.height;
    if (point.y > p.height) point.y -= p.height;

    const hue = p.fastMod360(point.hue + p.hueBase + i * 0.35 + p.time * 0.04);
    const glow = 2 + bassIntensity * 3 + pulse * 1.2;

    ctx.strokeStyle = p.hsla(hue, 90, 68, 0.12 + audioIntensity * 0.08);
    ctx.lineWidth = 0.8 + trebleIntensity * 0.8;
    ctx.beginPath();
    ctx.moveTo(point.x - point.vx * 4, point.y - point.vy * 4);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.fillStyle = p.hsla(hue, 96, 76, 0.35 + audioIntensity * 0.25);
    ctx.beginPath();
    ctx.arc(point.x, point.y, glow, 0, p.TWO_PI);
    ctx.fill();
  }

  ctx.restore();
}
