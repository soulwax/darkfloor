import type { FlowFieldPatternContext } from "./types";

interface Metaball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

const metaballs: Metaball[] = [];
const METABALL_COUNT = 6;

export function renderMetaballs(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const ctx = p.ctx;
  const width = p.width;
  const height = p.height;
  const radiusBase = Math.min(width, height) * 0.08;

  while (metaballs.length < METABALL_COUNT) {
    metaballs.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius: radiusBase,
      hue: Math.random() * 360,
    });
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < metaballs.length; i++) {
    const ball = metaballs[i];
    if (!ball) continue;

    ball.radius =
      radiusBase *
      (0.8 + bassIntensity * 0.9 + p.fastSin(p.time * 0.002 + i) * 0.25);
    ball.vx += p.fastSin(p.time * 0.0014 + i * 1.3) * 0.03;
    ball.vy += p.fastCos(p.time * 0.0011 + i * 1.7) * 0.03;
    ball.vx *= 0.995;
    ball.vy *= 0.995;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x < ball.radius || ball.x > width - ball.radius) {
      ball.vx *= -1;
    }
    if (ball.y < ball.radius || ball.y > height - ball.radius) {
      ball.vy *= -1;
    }

    ball.x = Math.max(ball.radius, Math.min(width - ball.radius, ball.x));
    ball.y = Math.max(ball.radius, Math.min(height - ball.radius, ball.y));

    const hue = p.fastMod360(ball.hue + p.hueBase + p.time * 0.03 + i * 22);
    const gradient = ctx.createRadialGradient(
      ball.x,
      ball.y,
      0,
      ball.x,
      ball.y,
      ball.radius * (1.6 + trebleIntensity * 0.35),
    );

    gradient.addColorStop(0, p.hsla(hue, 100, 84, 0.4 + audioIntensity * 0.25));
    gradient.addColorStop(0.45, p.hsla(hue + 28, 94, 68, 0.18 + bassIntensity * 0.18));
    gradient.addColorStop(1, p.hsla(hue + 60, 88, 54, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 1.8, 0, p.TWO_PI);
    ctx.fill();
  }

  ctx.restore();
}
