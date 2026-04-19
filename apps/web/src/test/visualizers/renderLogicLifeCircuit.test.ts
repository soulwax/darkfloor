import { describe, expect, it } from "vitest";
import {
  evaluateLogicGate,
  renderLogicLifeCircuit,
  stepGameOfLife,
} from "../../../../../packages/visualizers/src/flowfieldPatterns/renderLogicLifeCircuit";
import { makePatternContext } from "./canvas-mock";

describe("evaluateLogicGate", () => {
  it("computes core truth tables correctly", () => {
    expect(evaluateLogicGate("AND", true, true)).toBe(true);
    expect(evaluateLogicGate("AND", true, false)).toBe(false);
    expect(evaluateLogicGate("OR", false, true)).toBe(true);
    expect(evaluateLogicGate("NOT", true, false)).toBe(false);
    expect(evaluateLogicGate("NAND", true, true)).toBe(false);
    expect(evaluateLogicGate("XOR", true, false)).toBe(true);
    expect(evaluateLogicGate("XOR", true, true)).toBe(false);
  });
});

describe("stepGameOfLife", () => {
  it("preserves a 2x2 block still life", () => {
    const cols = 6;
    const rows = 6;
    const current = new Uint8Array(cols * rows);
    current[2 + 2 * cols] = 1;
    current[3 + 2 * cols] = 1;
    current[2 + 3 * cols] = 1;
    current[3 + 3 * cols] = 1;

    const next = stepGameOfLife(current, cols, rows);

    expect(next[2 + 2 * cols]).toBe(1);
    expect(next[3 + 2 * cols]).toBe(1);
    expect(next[2 + 3 * cols]).toBe(1);
    expect(next[3 + 3 * cols]).toBe(1);
  });

  it("turns a horizontal blinker into a vertical blinker", () => {
    const cols = 7;
    const rows = 7;
    const current = new Uint8Array(cols * rows);
    current[2 + 3 * cols] = 1;
    current[3 + 3 * cols] = 1;
    current[4 + 3 * cols] = 1;

    const next = stepGameOfLife(current, cols, rows);

    expect(next[3 + 2 * cols]).toBe(1);
    expect(next[3 + 3 * cols]).toBe(1);
    expect(next[3 + 4 * cols]).toBe(1);
  });
});

describe("renderLogicLifeCircuit", () => {
  it("does not throw with a default pattern context", () => {
    const pattern = makePatternContext();

    expect(() =>
      renderLogicLifeCircuit(pattern, 0.58, 0.44, 0.32),
    ).not.toThrow();
  });

  it("does not throw on Firefox detail settings", () => {
    const pattern = makePatternContext({ isFirefox: true });

    expect(() =>
      renderLogicLifeCircuit(pattern, 0.22, 0.18, 0.36),
    ).not.toThrow();
  });
});
