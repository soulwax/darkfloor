import { describe, expect, it } from "vitest";
import {
  renderSeismicPhaseMesh,
  sampleSeismicField,
  type Epicenter,
} from "../../../../../packages/visualizers/src/flowfieldPatterns/renderSeismicPhaseMesh";
import { makePatternContext } from "./canvas-mock";

describe("sampleSeismicField", () => {
  it("returns a finite value for a centered epicenter", () => {
    const epicenters: Epicenter[] = [
      {
        x: 300,
        y: 300,
        amplitude: 1,
        frequency: 0.08,
        decay: 0.01,
        phase: 0,
      },
    ];

    const value = sampleSeismicField(360, 360, epicenters, 12);
    expect(Number.isFinite(value)).toBe(true);
  });

  it("is symmetric around a centered epicenter", () => {
    const epicenters: Epicenter[] = [
      {
        x: 300,
        y: 300,
        amplitude: 1.2,
        frequency: 0.07,
        decay: 0.012,
        phase: Math.PI * 0.25,
      },
    ];

    const left = sampleSeismicField(240, 300, epicenters, 18);
    const right = sampleSeismicField(360, 300, epicenters, 18);

    expect(left).toBeCloseTo(right, 10);
  });
});

describe("renderSeismicPhaseMesh", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderSeismicPhaseMesh(pattern, 0.52, 0.46, 0.38),
    ).not.toThrow();
  });

  it("does not throw when dimensions change between renders", () => {
    const first = makePatternContext({ width: 800, height: 600 });
    const second = makePatternContext({ width: 1400, height: 900 });

    renderSeismicPhaseMesh(first, 0.3, 0.2, 0.4);

    expect(() =>
      renderSeismicPhaseMesh(second, 0.35, 0.28, 0.45),
    ).not.toThrow();
  });
});
