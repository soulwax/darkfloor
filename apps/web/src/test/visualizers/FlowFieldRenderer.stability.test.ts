import { describe, expect, it, vi } from "vitest";
import { FlowFieldRenderer } from "../../../../../packages/visualizers/src/FlowFieldRenderer";
import { makeCtxMock } from "./canvas-mock";

function makeCanvasMock(
  width = 800,
  height = 600,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const ctx = makeCtxMock();
  const canvas = {
    width,
    height,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx };
}

describe("FlowFieldRenderer stability", () => {
  it("renders perlinNoiseField without throwing", () => {
    const { canvas } = makeCanvasMock();
    const renderer = new FlowFieldRenderer(canvas);

    renderer.setPattern("perlinNoiseField", { immediate: true });

    expect(() =>
      renderer.render(new Uint8Array(1024).fill(128), 1024),
    ).not.toThrow();
  });

  it("falls back instead of freezing when a pattern throws", () => {
    const { canvas } = makeCanvasMock();
    const renderer = new FlowFieldRenderer(canvas);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    renderer.setPattern("perlinNoiseField", { immediate: true });

    const renderPatternSpy = vi
      .spyOn(
        renderer as unknown as { renderPattern: () => void },
        "renderPattern",
      )
      .mockImplementation(() => {
        throw new Error("synthetic render failure");
      });

    expect(() =>
      renderer.render(new Uint8Array(1024).fill(96), 1024),
    ).not.toThrow();
    expect(
      (renderer as unknown as { currentPattern: string }).currentPattern,
    ).toBe("rays");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    renderPatternSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
