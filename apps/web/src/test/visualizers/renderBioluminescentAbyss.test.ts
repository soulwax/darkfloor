import { describe, expect, it } from "vitest";
import { renderBioluminescentAbyss } from "../../../../packages/visualizers/src/flowfieldPatterns/renderBioluminescentAbyss";
import { makePatternContext } from "./canvas-mock";

describe("renderBioluminescentAbyss", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderBioluminescentAbyss(pattern, 0.55, 0.42, 0.31),
    ).not.toThrow();
  });

  it("does not throw on Firefox detail settings", () => {
    const pattern = makePatternContext({ isFirefox: true });

    expect(() =>
      renderBioluminescentAbyss(pattern, 0.2, 0.1, 0.4),
    ).not.toThrow();
  });

  it("reuses cached state across consecutive renders and resizes safely", () => {
    const initialPattern = makePatternContext({ width: 800, height: 600 });
    const resizedPattern = makePatternContext({ width: 1280, height: 720 });

    renderBioluminescentAbyss(initialPattern, 0.3, 0.3, 0.3);

    expect(() =>
      renderBioluminescentAbyss(initialPattern, 0.35, 0.2, 0.45),
    ).not.toThrow();
    expect(() =>
      renderBioluminescentAbyss(resizedPattern, 0.35, 0.2, 0.45),
    ).not.toThrow();
  });
});
