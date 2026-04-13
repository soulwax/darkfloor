// File: apps/web/src/test/visualizers/renderChladniResonance.test.ts
import { describe, it, expect } from "vitest";
import {
  chladniF,
  renderChladniResonance,
} from "../../../../packages/visualizers/src/flowfieldPatterns/renderChladniResonance";
import { makePatternContext } from "./canvas-mock";

describe("chladniF", () => {
  it("returns 0 at the canvas corners for m=n (degenerate case)", () => {
    // When m === n, cos(m*π*x/W)*cos(n*π*y/H) - cos(n*π*x/W)*cos(m*π*y/H) === 0
    const result = chladniF(0, 0, 2, 2, 800, 600);
    expect(result).toBeCloseTo(0, 10);
  });

  it("is antisymmetric: f(x,y,m,n) == -f(y,x,n,m) when W==H", () => {
    const W = 600;
    const H = 600;
    const a = chladniF(100, 200, 3, 4, W, H);
    const b = chladniF(200, 100, 4, 3, W, H);
    expect(a).toBeCloseTo(-b, 10);
  });

  it("returns a finite number for arbitrary inputs", () => {
    const result = chladniF(312, 471, 2, 3, 800, 600);
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe("renderChladniResonance smoke test", () => {
  it("does not throw with default context", () => {
    const p = makePatternContext();
    expect(() => renderChladniResonance(p, 0.5, 0.4, 0.3)).not.toThrow();
  });

  it("does not throw on Firefox (reduced particle count)", () => {
    const p = makePatternContext({ isFirefox: true });
    expect(() => renderChladniResonance(p, 0, 0, 0)).not.toThrow();
  });

  it("does not throw when called twice in a row (state reuse)", () => {
    const p = makePatternContext();
    renderChladniResonance(p, 0.2, 0.1, 0.5);
    expect(() => renderChladniResonance(p, 0.2, 0.1, 0.5)).not.toThrow();
  });

  it("does not throw when canvas dimensions change between calls", () => {
    const p1 = makePatternContext({ width: 800, height: 600 });
    renderChladniResonance(p1, 0, 0, 0);
    const p2 = makePatternContext({ width: 1280, height: 720 });
    expect(() => renderChladniResonance(p2, 0, 0, 0)).not.toThrow();
  });
});
