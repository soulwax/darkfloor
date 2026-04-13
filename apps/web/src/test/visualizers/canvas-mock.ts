// File: apps/web/src/test/visualizers/canvas-mock.ts
import { vi } from "vitest";
import type { FlowFieldPatternContext } from "../../../../packages/visualizers/src/flowfieldPatterns/types";

export function makeCtxMock(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
    set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
    set globalCompositeOperation(_v: GlobalCompositeOperation) {},
    set globalAlpha(_v: number) {},
    set lineWidth(_v: number) {},
    set lineCap(_v: CanvasLineCap) {},
    set lineJoin(_v: CanvasLineJoin) {},
  } as unknown as CanvasRenderingContext2D;
}

export function makePatternContext(
  overrides: Partial<FlowFieldPatternContext> = {},
): FlowFieldPatternContext {
  const W = 800;
  const H = 600;
  return {
    ctx: makeCtxMock(),
    width: W,
    height: H,
    centerX: W / 2,
    centerY: H / 2,
    time: 1000,
    hueBase: 180,
    TWO_PI: Math.PI * 2,
    detailScale: 1,
    isFirefox: false,
    fastSin: Math.sin,
    fastCos: Math.cos,
    fastSqrt: Math.sqrt,
    fastMod360: (x) => ((x % 360) + 360) % 360,
    hsla: (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a})`,
    ...overrides,
  };
}
