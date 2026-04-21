// File: apps/web/src/test/visualizers/canvas-mock.ts
import { vi } from "vitest";
import type { FlowFieldPatternContext } from "../../../../../packages/visualizers/src/flowfieldPatterns/types";

export function makeCtxMock(): CanvasRenderingContext2D {
  let fillStyle: string | CanvasGradient | CanvasPattern = "";
  let strokeStyle: string | CanvasGradient | CanvasPattern = "";
  let globalCompositeOperation: GlobalCompositeOperation = "source-over";
  let globalAlpha = 1;
  let lineWidth = 1;
  let lineCap: CanvasLineCap = "butt";
  let lineJoin: CanvasLineJoin = "miter";
  let miterLimit = 10;
  let shadowBlur = 0;
  let shadowOffsetX = 0;
  let shadowOffsetY = 0;
  let shadowColor = "";
  let filter = "none";

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
    drawImage: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyle = value;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      strokeStyle = value;
    },
    get globalCompositeOperation() {
      return globalCompositeOperation;
    },
    set globalCompositeOperation(value: GlobalCompositeOperation) {
      globalCompositeOperation = value;
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
    },
    get lineCap() {
      return lineCap;
    },
    set lineCap(value: CanvasLineCap) {
      lineCap = value;
    },
    get lineJoin() {
      return lineJoin;
    },
    set lineJoin(value: CanvasLineJoin) {
      lineJoin = value;
    },
    get miterLimit() {
      return miterLimit;
    },
    set miterLimit(value: number) {
      miterLimit = value;
    },
    get shadowBlur() {
      return shadowBlur;
    },
    set shadowBlur(value: number) {
      shadowBlur = value;
    },
    get shadowOffsetX() {
      return shadowOffsetX;
    },
    set shadowOffsetX(value: number) {
      shadowOffsetX = value;
    },
    get shadowOffsetY() {
      return shadowOffsetY;
    },
    set shadowOffsetY(value: number) {
      shadowOffsetY = value;
    },
    get shadowColor() {
      return shadowColor;
    },
    set shadowColor(value: string) {
      shadowColor = value;
    },
    get filter() {
      return filter;
    },
    set filter(value: string) {
      filter = value;
    },
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
