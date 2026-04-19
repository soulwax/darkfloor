import { describe, expect, it } from "vitest";
import {
  colliderBurstEnvelope,
  renderParticleColliderBloom,
} from "../../../../../packages/visualizers/src/flowfieldPatterns/renderParticleColliderBloom";
import { makePatternContext } from "./canvas-mock";

describe("colliderBurstEnvelope", () => {
  it("starts and ends at zero", () => {
    expect(colliderBurstEnvelope(0)).toBeCloseTo(0, 10);
    expect(colliderBurstEnvelope(1)).toBeCloseTo(0, 10);
  });

  it("peaks higher around the midpoint than near the edges", () => {
    expect(colliderBurstEnvelope(0.5)).toBeGreaterThan(
      colliderBurstEnvelope(0.1),
    );
    expect(colliderBurstEnvelope(0.5)).toBeGreaterThan(
      colliderBurstEnvelope(0.9),
    );
  });
});

describe("renderParticleColliderBloom", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderParticleColliderBloom(pattern, 0.6, 0.5, 0.42),
    ).not.toThrow();
  });

  it("does not throw on Firefox detail settings", () => {
    const pattern = makePatternContext({ isFirefox: true });

    expect(() =>
      renderParticleColliderBloom(pattern, 0.22, 0.26, 0.3),
    ).not.toThrow();
  });
});
