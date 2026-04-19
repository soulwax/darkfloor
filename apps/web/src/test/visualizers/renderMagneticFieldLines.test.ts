import { describe, expect, it } from "vitest";
import {
  renderMagneticFieldLines,
  sampleDipoleField,
} from "../../../../../packages/visualizers/src/flowfieldPatterns/renderMagneticFieldLines";
import { makePatternContext } from "./canvas-mock";

describe("sampleDipoleField", () => {
  it("returns finite vectors even close to both poles", () => {
    const target = { x: 0, y: 0 };
    const field = sampleDipoleField(1, 2, -60, 0, 60, 0, 240, target);

    expect(field).toBe(target);
    expect(Number.isFinite(field.x)).toBe(true);
    expect(Number.isFinite(field.y)).toBe(true);
  });

  it("mirrors cleanly across the horizontal axis for a symmetric dipole", () => {
    const top = sampleDipoleField(0, 48, -60, 0, 60, 0, 240, { x: 0, y: 0 });
    const bottom = sampleDipoleField(0, -48, -60, 0, 60, 0, 240, {
      x: 0,
      y: 0,
    });

    expect(top.x).toBeCloseTo(bottom.x, 10);
    expect(top.y).toBeCloseTo(-bottom.y, 10);
  });
});

describe("renderMagneticFieldLines", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderMagneticFieldLines(pattern, 0.48, 0.4, 0.26),
    ).not.toThrow();
  });

  it("does not throw on Firefox detail settings", () => {
    const pattern = makePatternContext({ isFirefox: true });

    expect(() =>
      renderMagneticFieldLines(pattern, 0.22, 0.18, 0.34),
    ).not.toThrow();
  });
});
