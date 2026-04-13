import { describe, expect, it } from "vitest";
import {
  renderGravitationalLensArray,
  sampleLensDeflection,
  type LensMass,
} from "../../../../packages/visualizers/src/flowfieldPatterns/renderGravitationalLensArray";
import { makePatternContext } from "./canvas-mock";

describe("sampleLensDeflection", () => {
  it("returns finite vectors for a mirrored lens set", () => {
    const lenses: LensMass[] = [
      { x: -40, y: 0, mass: 1.5 },
      { x: 40, y: 0, mass: 1.5 },
    ];

    const field = sampleLensDeflection(0, 50, lenses, 320, { x: 0, y: 0 });

    expect(Number.isFinite(field.x)).toBe(true);
    expect(Number.isFinite(field.y)).toBe(true);
  });

  it("cancels horizontal deflection on the symmetry axis", () => {
    const lenses: LensMass[] = [
      { x: -60, y: 0, mass: 2 },
      { x: 60, y: 0, mass: 2 },
    ];

    const field = sampleLensDeflection(0, 80, lenses, 320, { x: 0, y: 0 });

    expect(field.x).toBeCloseTo(0, 10);
  });
});

describe("renderGravitationalLensArray", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderGravitationalLensArray(pattern, 0.58, 0.44, 0.36),
    ).not.toThrow();
  });

  it("does not throw on Firefox detail settings", () => {
    const pattern = makePatternContext({ isFirefox: true });

    expect(() =>
      renderGravitationalLensArray(pattern, 0.24, 0.18, 0.31),
    ).not.toThrow();
  });
});
