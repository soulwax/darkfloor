import type { FlowFieldPatternContext } from "./types";

type LogicGateKind = "AND" | "OR" | "NOT" | "NAND" | "XOR";

interface LogicGate {
  kind: LogicGateKind;
  x: number;
  y: number;
  width: number;
  height: number;
  phase: number;
  hueOffset: number;
}

interface LogicLifeState {
  cols: number;
  rows: number;
  cellSize: number;
  grid: Uint8Array;
  next: Uint8Array;
  age: Uint16Array;
  gates: LogicGate[];
  generation: number;
}

const LOGIC_GATE_KINDS: LogicGateKind[] = ["AND", "OR", "NOT", "NAND", "XOR"];

const GATE_TEMPLATES: Record<LogicGateKind, readonly string[]> = {
  AND: [
    "                  ",
    "    #######       ",
    "aa ##     ### ooo ",
    "   #       ##   o ",
    "bb ##     ### ooo ",
    "    #######       ",
    "                  ",
  ],
  OR: [
    "                  ",
    "     #####        ",
    "aa  ##   ###  ooo ",
    "   ##      ##   o ",
    "bb  ##   ###  ooo ",
    "     #####        ",
    "                  ",
  ],
  NOT: [
    "                  ",
    "aa ##             ",
    "   ####           ",
    "   ######    oo   ",
    "   ####           ",
    "aa ##             ",
    "                  ",
  ],
  NAND: [
    "                  ",
    "    #######       ",
    "aa ##     #### oo ",
    "   #       ###  o ",
    "bb ##     #### oo ",
    "    #######       ",
    "                  ",
  ],
  XOR: [
    "                  ",
    "   ## #####       ",
    "aa ## ##  ### ooo ",
    "   ##     ###   o ",
    "bb ## ##  ### ooo ",
    "   ## #####       ",
    "                  ",
  ],
};

let logicLifeState: LogicLifeState | null = null;

function cellIndex(x: number, y: number, cols: number): number {
  return y * cols + x;
}

function setAlive(
  grid: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
): void {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  grid[cellIndex(x, y, cols)] = 1;
}

function stampBlock(
  grid: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
): void {
  setAlive(grid, cols, rows, x, y);
  setAlive(grid, cols, rows, x + 1, y);
  setAlive(grid, cols, rows, x, y + 1);
  setAlive(grid, cols, rows, x + 1, y + 1);
}

function stampBlinker(
  grid: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
  horizontal: boolean,
): void {
  if (horizontal) {
    setAlive(grid, cols, rows, x - 1, y);
    setAlive(grid, cols, rows, x, y);
    setAlive(grid, cols, rows, x + 1, y);
    return;
  }

  setAlive(grid, cols, rows, x, y - 1);
  setAlive(grid, cols, rows, x, y);
  setAlive(grid, cols, rows, x, y + 1);
}

function stampGlider(
  grid: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
  mirror: boolean,
): void {
  const points = mirror
    ? [
        [0, 1],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
      ]
    : [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 1],
      ];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    setAlive(grid, cols, rows, x + point[0], y + point[1]);
  }
}

export function evaluateLogicGate(
  kind: LogicGateKind,
  inputA: boolean,
  inputB: boolean,
): boolean {
  switch (kind) {
    case "AND":
      return inputA && inputB;
    case "OR":
      return inputA || inputB;
    case "NOT":
      return !inputA;
    case "NAND":
      return !(inputA && inputB);
    case "XOR":
      return inputA !== inputB;
  }
}

export function stepGameOfLife(
  current: Uint8Array,
  cols: number,
  rows: number,
  target: Uint8Array = new Uint8Array(current.length),
): Uint8Array {
  target.fill(0);

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const idx = cellIndex(x, y, cols);
      let neighbors = 0;

      neighbors += current[idx - cols - 1] ?? 0;
      neighbors += current[idx - cols] ?? 0;
      neighbors += current[idx - cols + 1] ?? 0;
      neighbors += current[idx - 1] ?? 0;
      neighbors += current[idx + 1] ?? 0;
      neighbors += current[idx + cols - 1] ?? 0;
      neighbors += current[idx + cols] ?? 0;
      neighbors += current[idx + cols + 1] ?? 0;

      const alive = current[idx] === 1;
      target[idx] = alive
        ? neighbors === 2 || neighbors === 3
          ? 1
          : 0
        : neighbors === 3
          ? 1
          : 0;
    }
  }

  return target;
}

function buildLogicGates(cols: number, rows: number): LogicGate[] {
  const gateWidth = 18;
  const gateHeight = 7;
  const slotsX = Math.max(1, Math.floor((cols - 8) / (gateWidth + 3)));
  const slotsY = Math.max(1, Math.floor((rows - 8) / (gateHeight + 4)));
  const capacity = Math.max(1, slotsX * slotsY);
  const gateCount = Math.max(3, Math.min(LOGIC_GATE_KINDS.length, capacity));
  const kinds = [...LOGIC_GATE_KINDS];

  for (let i = kinds.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }

  const gates: LogicGate[] = [];
  const startX = Math.max(2, ((cols - slotsX * (gateWidth + 3)) / 2) | 0);
  const startY = Math.max(2, ((rows - slotsY * (gateHeight + 4)) / 2) | 0);

  for (let index = 0; index < gateCount; index++) {
    const slotX = index % slotsX;
    const slotY = Math.floor(index / slotsX);
    const jitterX = ((Math.random() * 3) | 0) - 1;
    const jitterY = ((Math.random() * 3) | 0) - 1;
    gates.push({
      kind: kinds[index % kinds.length]!,
      x: startX + slotX * (gateWidth + 3) + jitterX,
      y: startY + slotY * (gateHeight + 4) + jitterY,
      width: gateWidth,
      height: gateHeight,
      phase: Math.random() * Math.PI * 2,
      hueOffset: (index * 47 + (Math.random() * 12) | 0) % 360,
    });
  }

  return gates;
}

function createLogicLifeState(
  cols: number,
  rows: number,
  cellSize: number,
): LogicLifeState {
  const grid = new Uint8Array(cols * rows);
  const next = new Uint8Array(cols * rows);
  const age = new Uint16Array(cols * rows);
  const gates = buildLogicGates(cols, rows);

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (Math.random() < 0.045) {
        grid[cellIndex(x, y, cols)] = 1;
      }
    }
  }

  return {
    cols,
    rows,
    cellSize,
    grid,
    next,
    age,
    gates,
    generation: 0,
  };
}

function ensureLogicLifeState(
  cols: number,
  rows: number,
  cellSize: number,
): LogicLifeState {
  if (
    logicLifeState &&
    logicLifeState.cols === cols &&
    logicLifeState.rows === rows &&
    logicLifeState.cellSize === cellSize
  ) {
    return logicLifeState;
  }

  logicLifeState = createLogicLifeState(cols, rows, cellSize);
  return logicLifeState;
}

function refreshCellAges(
  grid: Uint8Array,
  age: Uint16Array,
): void {
  for (let i = 0; i < grid.length; i++) {
    if ((grid[i] ?? 0) === 1) {
      age[i] = Math.min(255, (age[i] ?? 0) + 1);
    } else if ((age[i] ?? 0) > 0) {
      age[i] = age[i]! - 1;
    }
  }
}

function stampGateTemplate(
  state: LogicLifeState,
  gate: LogicGate,
  inputA: boolean,
  inputB: boolean,
  output: boolean,
): void {
  const pattern = GATE_TEMPLATES[gate.kind];
  if (!pattern) return;

  for (let row = 0; row < pattern.length; row++) {
    const line = pattern[row] ?? "";
    for (let col = 0; col < line.length; col++) {
      const token = line[col];
      const x = gate.x + col;
      const y = gate.y + row;

      if (token === "#") {
        if (((row + col) & 1) === 0) {
          stampBlock(state.grid, state.cols, state.rows, x, y);
        } else {
          setAlive(state.grid, state.cols, state.rows, x, y);
        }
        continue;
      }

      if (token === "a" && inputA) {
        stampBlinker(
          state.grid,
          state.cols,
          state.rows,
          x,
          y,
          true,
        );
        continue;
      }

      if (token === "b" && inputB) {
        stampBlinker(
          state.grid,
          state.cols,
          state.rows,
          x,
          y,
          true,
        );
        continue;
      }

      if (token === "o" && output) {
        setAlive(state.grid, state.cols, state.rows, x, y);
      }
    }
  }
}

function injectLogicGates(
  state: LogicLifeState,
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  for (let i = 0; i < state.gates.length; i++) {
    const gate = state.gates[i];
    if (!gate) continue;

    const inputA =
      p.fastSin(state.generation * 0.18 + gate.phase + audioIntensity * 2.4) >
      0.08 - bassIntensity * 0.14;
    const inputB =
      gate.kind === "NOT"
        ? false
        : p.fastCos(
            state.generation * 0.16 +
              gate.phase * 1.31 +
              trebleIntensity * 1.8,
          ) >
          0.12;
    const output = evaluateLogicGate(gate.kind, inputA, inputB);

    stampGateTemplate(state, gate, inputA, inputB, output);

    if ((state.generation + i) % 14 === 0 && inputA) {
      stampGlider(
        state.grid,
        state.cols,
        state.rows,
        gate.x - 1,
        gate.y + 1,
        false,
      );
    }

    if ((state.generation + i * 2) % 17 === 0 && inputB && gate.kind !== "NOT") {
      stampGlider(
        state.grid,
        state.cols,
        state.rows,
        gate.x - 1,
        gate.y + 4,
        false,
      );
    }

    if ((state.generation + i) % 11 === 0 && output) {
      stampGlider(
        state.grid,
        state.cols,
        state.rows,
        gate.x + gate.width - 3,
        gate.y + 2,
        true,
      );
    }
  }
}

export function renderLogicLifeCircuit(
  p: FlowFieldPatternContext,
  audioIntensity: number,
  bassIntensity: number,
  trebleIntensity: number,
): void {
  const cellSize = Math.max(
    6,
    Math.min(
      p.isFirefox ? 12 : 11,
      Math.round(Math.min(p.width, p.height) / (p.isFirefox ? 68 : 82)),
    ),
  );
  const cols = Math.max(42, Math.floor(p.width / cellSize));
  const rows = Math.max(24, Math.floor(p.height / cellSize));
  const state = ensureLogicLifeState(cols, rows, cellSize);
  const stepsPerFrame = bassIntensity > 0.72 ? 2 : 1;

  for (let step = 0; step < stepsPerFrame; step++) {
    injectLogicGates(state, p, audioIntensity, bassIntensity, trebleIntensity);

    if (state.generation % 41 === 0) {
      for (let i = 0; i < 10; i++) {
        setAlive(
          state.grid,
          state.cols,
          state.rows,
          1 + ((Math.random() * (state.cols - 2)) | 0),
          1 + ((Math.random() * (state.rows - 2)) | 0),
        );
      }
    }

    stepGameOfLife(state.grid, state.cols, state.rows, state.next);
    [state.grid, state.next] = [state.next, state.grid];
    state.generation += 1;
  }

  refreshCellAges(state.grid, state.age);

  const ctx = p.ctx;
  const cellDrawSize = Math.max(1.5, cellSize - 1);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < state.grid.length; i++) {
    const alive = (state.grid[i] ?? 0) === 1;
    const age = state.age[i] ?? 0;
    if (!alive && age < 2) continue;

    const x = i % state.cols;
    const y = (i / state.cols) | 0;
    const px = x * state.cellSize;
    const py = y * state.cellSize;
    const hue = p.fastMod360(
      p.hueBase +
        x * 2.3 +
        y * 1.7 +
        state.generation * 0.8 +
        age * 1.2,
    );
    const alpha = alive
      ? 0.08 + Math.min(0.32, age * 0.012) + audioIntensity * 0.08
      : Math.min(0.08, age * 0.01);
    const lightness = alive ? 46 + Math.min(32, age * 2) : 28 + age;

    ctx.fillStyle = p.hsla(hue, 96, lightness, alpha);
    ctx.fillRect(px, py, cellDrawSize, cellDrawSize);
  }

  for (let i = 0; i < state.gates.length; i++) {
    const gate = state.gates[i];
    if (!gate) continue;

    ctx.strokeStyle = p.hsla(
      p.fastMod360(p.hueBase + gate.hueOffset),
      100,
      72,
      0.06 + audioIntensity * 0.04,
    );
    ctx.lineWidth = 1;
    ctx.strokeRect(
      gate.x * state.cellSize,
      gate.y * state.cellSize,
      gate.width * state.cellSize,
      gate.height * state.cellSize,
    );
  }

  ctx.restore();
}
