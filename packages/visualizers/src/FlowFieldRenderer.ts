// File: packages/visualizers/src/FlowFieldRenderer.ts

import type { Pattern } from "./flowfieldPatterns/patternIds";
import { renderHexGrid } from "./flowfieldPatterns/renderHexGrid";
import { renderKaleidoscope } from "./flowfieldPatterns/renderKaleidoscope";
import { renderRays } from "./flowfieldPatterns/renderRays";
import type { FlowFieldPatternContext } from "./flowfieldPatterns/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
  maxLife: number;
  angle: number;
  angularVelocity: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  age: number;
  maxAge: number;
  popping: boolean;
  popProgress: number;
  symbolType: number;
  rotation: number;
}

export class FlowFieldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private bubbles: Bubble[] = [];
  private time = 0;
  private width = 0;
  private height = 0;
  private centerX = 0;
  private centerY = 0;
  private hueBase = 0;
  private qualityScale = 1;
  private qualityFrameTime = 16.67;
  private qualityLastTime = 0;
  private qualityWarmupFrames = 0;
  private isFirefox = false;
  private showFpsCounter = false;
  private firefoxLowFpsStreak = 0;
  private firefoxLastContextResetAt = 0;

  private static readonly FIREFOX_LOW_FPS_FRAME_TIME_MS = 200;
  private static readonly FIREFOX_LOW_FPS_REQUIRED_FRAMES = 8;
  private static readonly FIREFOX_LOW_FPS_RESET_COOLDOWN_MS = 10_000;

  private patternTimer = 0;
  private patternDuration = 10;
  private transitionProgress = 0;
  private transitionSpeed = 0.015;
  private isTransitioning = false;
  private hasLoggedInitialPattern = false;
  private patternsSinceReset = 0;
  private allPatterns: Pattern[] = [
    "rays",
    "galaxy",
    "fractal",
    "tunnel",
    "lightning",
    "bubbles",
    "fireworks",
    "starfield",
    "waves",
    "matrix",
    "swarm",
    "lissajous",
    "mandala",
    "rings",
    "dna",
    "fluid",
    "hexgrid",
    "spirograph",
    "constellation",
    "pentagram",
    "runes",
    "sigils",
    "ouroboros",
    "chakras",
    "alchemy",
    "celestial",
    "portal",
    "dreamcatcher",
    "phoenix",
    "serpent",
    "crystalGrid",
    "moonPhases",
    "astrolabe",
    "tarot",
    "kabbalah",
    "merkaba",
    "flowerOfLife",
    "sriYantra",
    "metatron",
    "vesicaPiscis",
    "torusField",
    "cosmicEgg",
    "enochian",
    "labyrinth",
    "cosmicWeb",
    "vortexSpiral",
    "sacredSpiral",
    "runicSpiral",
    "elementalCross",
    "dragonEye",
    "ancientGlyphs",
    "timeWheel",
    "astralProjection",
    "ethericField",
    "platonic",
    "infinityKnot",
    "cosmicLotus",
    "voidMandala",
    "stellarMap",
    "wyrdWeb",
    "spiritualGateway",
    "akashicRecords",
    "sacredGeometry",
    "shadowRealm",
    "quantumEntanglement",
    "necromanticSigil",
    "dimensionalRift",
    "chaosVortex",
    "etherealMist",
    "bloodMoon",
    "darkMatter",
    "soulFragment",
    "forbiddenRitual",
    "twilightZone",
    "spectralEcho",
    "voidWhisper",
    "demonicGate",
    "cursedRunes",
    "shadowDance",
    "nightmareFuel",
    "abyssalDepth",
    "phantomPulse",
    "infernalFlame",
    "kaleidoscope",
    "hydrogenElectronOrbitals",
    "plasmaStorm",
    "bitfieldMatrix",
    "mandelbrotSpiral",
    "quantumResonance",
    "morseAurora",
    "chromaticAberration",
    "mengerSponge",
    "perlinNoiseField",
    "superformula",
    "voronoi",
    "dragonCurve",
    "langtonsAnt",
    "celticKnot",
    "germanicKnot",
    "solarFlare",
    "transcendence",
    "treeOfLife",
    "divineLight",
    "gothicThorns",
    "sacredTriangle",
    "emField",
    "quantumFoam",
    "prismBloom",
    "auroraWeave",
    "orbitShards",
    "harmonicPetals",
    "latticeDrift",
    "nebulaDrift",
    "crystalPulse",
    "tesseractSpin",
    "scanGrid",
    "pulseColumns",
    "radarSweep",
    "cometTrails",
    "phaseBands",
    "valknut",
  ];

  private currentPattern: Pattern = "kaleidoscope";
  private nextPattern: Pattern =
    this.allPatterns[Math.floor(Math.random() * this.allPatterns.length)] ??
    "kaleidoscope";
  private patternSequence: Pattern[] = [];
  private patternIndex = 0;

  private fractalZoom = 1;
  private fractalOffsetX = -0.5;
  private fractalOffsetY = 0;
  private juliaC = { re: -0.7, im: 0.27 };
  private fractalImageData: ImageData | null = null;
  private fractalImageDataWidth = 0;
  private fractalImageDataHeight = 0;

  private particleCount = 800;
  private particleSize = 2.0;
  private particleSpeed = 1.0;
  private bubbleCount = 40;
  private bubbleSize = 1.0;
  private bubbleSpeed = 1.0;
  private starCount = 200;
  private starSpeed = 1.0;
  private rayCount = 24;
  private waveCount = 5;
  private waveAmplitude = 1.0;
  private ringCount = 15;
  private lightningCount = 1;
  private matrixSpeed = 1.0;
  private tunnelSpeed = 1.0;
  private galaxyArmCount = 4;
  private mandalaLayers = 5;

  private tarotCardSize = 1.0;
  private tarotCardCount = 8;
  private sacredSpiralCount = 3;
  private sacredSpiralTightness = 1.0;
  private pentagramSize = 1.0;
  private pentagramRotationSpeed = 1.0;
  private runeSize = 1.0;
  private runeCount = 8;
  private sigilCount = 6;
  private sigilSize = 1.0;
  private chakraSize = 1.0;
  private chakraSpacing = 1.0;
  private portalSize = 1.0;
  private portalRingCount = 5;
  private phoenixWingSpan = 1.0;
  private crystalGridSize = 1.0;
  private crystalCount = 12;
  private moonPhaseCount = 8;
  private moonPhaseSize = 1.0;
  private flowerOfLifeCircleCount = 7;
  private flowerOfLifeSize = 1.0;
  private metatronNodeCount = 13;
  private metatronSize = 1.0;
  private torusRingCount = 12;
  private torusThickness = 1.0;
  private labyrinthComplexity = 1.0;
  private labyrinthPathWidth = 1.0;
  private vortexSpiralCount = 4;
  private vortexRotationSpeed = 1.0;
  private dragonEyeSize = 1.0;
  private dragonPupilSize = 1.0;
  private ancientGlyphCount = 16;
  private ancientGlyphSize = 1.0;
  private platonicSize = 1.0;
  private platonicRotationSpeed = 1.0;
  private cosmicLotusLayerCount = 5;
  private cosmicLotusPetalCount = 8;
  private kaleidoscopeSegments = 24;
  private kaleidoscopeRotationSpeed = 1.0;
  private kaleidoscopeParticleDensity = 1.0;
  private kaleidoscopeColorShift = 1.0;

  private hydrogenEnergyLevel = 1;
  private hydrogenEnergyLevelTimer = 0;
  private hydrogenEnergyLevelDuration = 300;
  private hydrogenElectrons: {
    x: number;
    y: number;
    z: number;
    angle: number;
    phase: number;
    speed: number;
  }[] = [];
  private readonly MAX_ENERGY_LEVEL = 6;

  private lightningBolts: {
    segments: { x: number; y: number }[];
    life: number;
    maxLife: number;
  }[] = [];

  private fireworks: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    life: number;
    maxLife: number;
    size: number;
    dead: boolean;
  }[] = [];
  private fireworksPool: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    life: number;
    maxLife: number;
    size: number;
    dead: boolean;
  }[] = [];
  private fireworksActiveCount = 0;
  private fireworksCleanupCounter = 0;

  private matrixColumns: { y: number; speed: number; chars: string }[] = [];

  private stars: { x: number; y: number; z: number; size: number }[] = [];

  private constellationStars: {
    x: number;
    y: number;
    connections: number[];
  }[] = [];

  private stellarMapStars: {
    x: number;
    y: number;
    size: number;
    hue: number;
  }[] = [];

  private static readonly SIN_TABLE_SIZE = 4096;
  private static readonly SIN_TABLE = FlowFieldRenderer.initSinTable();
  private static readonly COS_TABLE = FlowFieldRenderer.initCosTable();
  private static readonly TWO_PI = Math.PI * 2;
  private static readonly INV_TWO_PI = 1 / (Math.PI * 2);
  private static readonly SQRT3 = 1.7320508075688772;
  private static readonly HUE_255_TO_360 = 360 / 255;
  private static readonly TRAIL_PATTERNS = new Set<Pattern>([
    "swarm",
    "fireworks",
    "starfield",
    "constellation",
  ]);
  private static readonly MYSTICAL_HUES = [
    270, 280, 290, 240, 250, 0, 330, 340, 180, 200, 310, 350,
  ] as const;
  private static readonly CHAKRA_COLORS = [
    { h: 0, name: "Root" },
    { h: 30, name: "Sacral" },
    { h: 60, name: "Solar" },
    { h: 120, name: "Heart" },
    { h: 200, name: "Throat" },
    { h: 270, name: "Third Eye" },
    { h: 300, name: "Crown" },
  ] as const;
  private static readonly ALCHEMY_SYMBOLS = [
    { name: "Fire", rotation: 0 },
    { name: "Water", rotation: Math.PI },
    { name: "Air", rotation: Math.PI * 0.5 },
    { name: "Earth", rotation: Math.PI * 1.5 },
  ] as const;
  private static readonly ELEMENTAL_CROSS_ELEMENTS = [
    { angle: 0, hue: 15, symbol: "△" },
    { angle: Math.PI * 0.5, hue: 60, symbol: "△" },
    { angle: Math.PI, hue: 200, symbol: "▽" },
    { angle: Math.PI * 1.5, hue: 120, symbol: "▽" },
  ] as const;
  private static readonly KABBALAH_SEPHIROT = [
    { x: 0, y: -200, name: "Kether", hueOffset: 0 },
    { x: -80, y: -120, name: "Chokmah", hueOffset: 36 },
    { x: 80, y: -120, name: "Binah", hueOffset: 72 },
    { x: -80, y: -40, name: "Chesed", hueOffset: 108 },
    { x: 80, y: -40, name: "Geburah", hueOffset: 144 },
    { x: 0, y: 0, name: "Tiphareth", hueOffset: 180 },
    { x: -80, y: 80, name: "Netzach", hueOffset: 216 },
    { x: 80, y: 80, name: "Hod", hueOffset: 252 },
    { x: 0, y: 140, name: "Yesod", hueOffset: 288 },
    { x: 0, y: 220, name: "Malkuth", hueOffset: 324 },
  ] as const;
  private static readonly KABBALAH_PATHS: ReadonlyArray<
    readonly [number, number]
  > = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [4, 5],
    [3, 6],
    [4, 7],
    [5, 6],
    [5, 7],
    [6, 7],
    [6, 8],
    [7, 8],
    [8, 9],
    [5, 8],
  ];
  private static readonly SRI_YANTRA_TRIANGLES = [
    { rotation: 0, inverted: true, scale: 1.0, hue: 0 },
    { rotation: Math.PI * 0.4, inverted: true, scale: 0.85, hue: 40 },
    { rotation: Math.PI * 0.8, inverted: true, scale: 0.7, hue: 80 },
    { rotation: Math.PI * 1.2, inverted: true, scale: 0.55, hue: 120 },
    { rotation: Math.PI * 1.6, inverted: true, scale: 0.4, hue: 160 },
    { rotation: Math.PI * 0.2, inverted: false, scale: 0.95, hue: 200 },
    { rotation: Math.PI * 0.6, inverted: false, scale: 0.8, hue: 240 },
    { rotation: Math.PI, inverted: false, scale: 0.65, hue: 280 },
    { rotation: Math.PI * 1.4, inverted: false, scale: 0.5, hue: 320 },
  ] as const;
  private static readonly ENOCHIAN_CHARS = [
    "⊕",
    "⊗",
    "⊙",
    "☉",
    "☊",
    "☋",
    "☌",
    "☍",
    "⚹",
    "⚺",
    "⚻",
    "⚼",
  ] as const;
  private static readonly ANCIENT_GLYPHS = [
    "ᚠ",
    "ᚢ",
    "ᚦ",
    "ᚨ",
    "ᚱ",
    "ᚲ",
    "ᚷ",
    "ᚹ",
    "☥",
    "☦",
    "☧",
    "☨",
    "☩",
    "☪",
    "☫",
    "☬",
  ] as const;
  private static readonly PLATONIC_SOLIDS = [
    { sides: 3, hue: 0 },
    { sides: 4, hue: 72 },
    { sides: 3, hue: 144 },
    { sides: 5, hue: 216 },
    { sides: 3, hue: 288 },
  ] as const;
  private static readonly METATRON_OFFSETS: ReadonlyArray<
    readonly [number, number]
  > = [
    [0, 0],
    [0, -1],
    [0.866, -0.5],
    [0.866, 0.5],
    [0, 1],
    [-0.866, 0.5],
    [-0.866, -0.5],
    [0, -0.5],
    [0.433, -0.25],
    [0.433, 0.25],
    [0, 0.5],
    [-0.433, 0.25],
    [-0.433, -0.25],
  ];

  private static initSinTable(): Float32Array {
    const table = new Float32Array(this.SIN_TABLE_SIZE);
    for (let i = 0; i < this.SIN_TABLE_SIZE; i++) {
      table[i] = Math.sin((i / this.SIN_TABLE_SIZE) * Math.PI * 2);
    }
    return table;
  }

  private static initCosTable(): Float32Array {
    const table = new Float32Array(this.SIN_TABLE_SIZE);
    for (let i = 0; i < this.SIN_TABLE_SIZE; i++) {
      table[i] = Math.cos((i / this.SIN_TABLE_SIZE) * Math.PI * 2);
    }
    return table;
  }

  private fastSin(angle: number): number {
    const idx =
      (angle *
        FlowFieldRenderer.INV_TWO_PI *
        FlowFieldRenderer.SIN_TABLE_SIZE) &
      (FlowFieldRenderer.SIN_TABLE_SIZE - 1);
    return FlowFieldRenderer.SIN_TABLE[idx] ?? 0;
  }

  private fastCos(angle: number): number {
    const idx =
      (angle *
        FlowFieldRenderer.INV_TWO_PI *
        FlowFieldRenderer.SIN_TABLE_SIZE) &
      (FlowFieldRenderer.SIN_TABLE_SIZE - 1);
    return FlowFieldRenderer.COS_TABLE[idx] ?? 0;
  }

  private hslCache = new Map<string, [number, number, number]>();
  private hslCacheMaxSize = 1024;

  private radialGradientPool: CanvasGradient[] = [];
  private linearGradientPool: CanvasGradient[] = [];
  private gradientPoolIndex = 0;

  private spatialGrid: Map<string, Particle[]> = new Map<string, Particle[]>();
  private gridCellSize = 100;

  private particlePool: Particle[] = [];
  private bubblePool: Bubble[] = [];

  private tempColorArray: [number, number, number] = [0, 0, 0];
  private metatronPositions = new Float32Array(26);
  private metatronHexPoints = new Float32Array(12);
  private emChargeX = new Float32Array(8);
  private emChargeY = new Float32Array(8);
  private emChargeSign = new Float32Array(8);
  private sacredTrianglePoints = new Float32Array(6);
  private sacredInnerTrianglePoints = new Float32Array(6);
  private voronoiSeedData = new Float32Array(0);
  private chaosVortexRadiusMods = new Float32Array(0);
  private langtonsAntGrid = new Uint8Array(0);
  private langtonsAntGridSize = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.centerX = this.width >> 1;
    this.centerY = this.height >> 1;
    if (typeof navigator !== "undefined") {
      this.isFirefox = /firefox/i.test(navigator.userAgent ?? "");
    }

    this.shufflePatterns();
    this.initializeParticles();
    this.initializeBubbles();
  }

  private formatPatternName(pattern: Pattern): string {
    const neutralNames: Partial<Record<Pattern, string>> = {
      pentagram: "Star Weave",
      sigils: "Glyph Weave",
      necromanticSigil: "Ancient Sigil",
      demonicGate: "Arcane Gate",
      cursedRunes: "Runic Flow",
      nightmareFuel: "Dream Drift",
      infernalFlame: "Ember Flame",
      shadowRealm: "Dusk Realm",
      bloodMoon: "Crimson Moon",
      forbiddenRitual: "Mystic Ceremony",
      voidWhisper: "Quiet Void",
      soulFragment: "Soul Spectrum",
      abyssalDepth: "Deep Current",
    };

    if (neutralNames[pattern]) {
      return neutralNames[pattern];
    }

    return pattern
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private logPatternChange(
    pattern: Pattern,
    event:
      | "playing"
      | "transitioning-to"
      | "transitioned-to"
      | "manual-selection",
  ): void {
    const formattedName = this.formatPatternName(pattern);
    const emoji =
      event === "playing"
        ? "🎨"
        : event === "transitioning-to"
          ? "🔄"
          : event === "manual-selection"
            ? "🎯"
            : "✨";
    const message =
      event === "playing"
        ? `${emoji} Visual playing: ${formattedName}`
        : event === "transitioning-to"
          ? `${emoji} Transitioning to: ${formattedName}`
          : event === "manual-selection"
            ? `${emoji} Manually selected: ${formattedName}`
            : `${emoji} Now playing: ${formattedName}`;
    console.log(`[Visual] ${message}`);
  }

  private shufflePatterns(): void {
    this.patternSequence = [...this.allPatterns];
    for (let i = this.patternSequence.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [this.patternSequence[i], this.patternSequence[j]] = [
        this.patternSequence[j]!,
        this.patternSequence[i]!,
      ];
    }
  }

  private cachedHslToRgb(
    h: number,
    s: number,
    l: number,
  ): [number, number, number] {
    const key = `${h | 0},${(s * 100) | 0},${(l * 100) | 0}`;
    let cached = this.hslCache.get(key);
    if (cached) return cached;

    cached = this.hslToRgb(h, s, l);

    if (this.hslCache.size >= this.hslCacheMaxSize) {
      const firstKey = this.hslCache.keys().next().value!;
      this.hslCache.delete(firstKey);
    }

    this.hslCache.set(key, cached);
    return cached;
  }

  private updateSpatialGrid(): void {
    this.spatialGrid.clear();

    for (const particle of this.particles) {
      const cellX = (particle.x / this.gridCellSize) | 0;
      const cellY = (particle.y / this.gridCellSize) | 0;
      const key = `${cellX},${cellY}`;

      let cell = this.spatialGrid.get(key);
      if (!cell) {
        cell = [];
        this.spatialGrid.set(key, cell);
      }
      cell.push(particle);
    }
  }

  private getNearbyParticles(particle: Particle): Particle[] {
    const cellX = (particle.x / this.gridCellSize) | 0;
    const cellY = (particle.y / this.gridCellSize) | 0;
    const nearby: Particle[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const cell = this.spatialGrid.get(key);
        if (cell) nearby.push(...cell);
      }
    }

    return nearby;
  }

  private getParticleFromPool(): Particle {
    return this.particlePool.pop() ?? this.createParticle();
  }

  private returnParticleToPool(particle: Particle): void {
    if (this.particlePool.length < 1000) {
      this.particlePool.push(particle);
    }
  }

  private getBubbleFromPool(): Bubble {
    return this.bubblePool.pop() ?? this.createBubble();
  }

  private returnBubbleToPool(bubble: Bubble): void {
    if (this.bubblePool.length < 100) {
      this.bubblePool.push(bubble);
    }
  }

  private distanceSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  private normalize(x: number, y: number, length: number): [number, number] {
    if (length === 0) return [0, 0];
    const invLength = 1 / length;
    return [x * invLength, y * invLength];
  }

  private fastSqrt(x: number): number {
    if (x === 0) return 0;

    let guess = x;
    guess = (guess + x / guess) * 0.5;
    guess = (guess + x / guess) * 0.5;
    return guess;
  }

  private colorStringCache = new Map<string, string>();
  private colorStringCacheMaxSize = 512;

  private hsla(h: number, s: number, l: number, a: number): string {
    const key = `${h | 0},${s | 0},${l | 0},${(a * 100) | 0}`;
    let cached = this.colorStringCache.get(key);
    if (cached) return cached;

    const hInt = h | 0;
    const sInt = s | 0;
    const lInt = l | 0;
    const aFixed = ((a * 100) | 0) / 100;
    cached = `hsla(${hInt}, ${sInt}%, ${lInt}%, ${aFixed})`;

    if (this.colorStringCache.size >= this.colorStringCacheMaxSize) {
      const firstKey = this.colorStringCache.keys().next().value!;
      this.colorStringCache.delete(firstKey);
    }

    this.colorStringCache.set(key, cached);
    return cached;
  }

  private fastMod360(x: number): number {
    while (x >= 360) x -= 360;
    while (x < 0) x += 360;
    return x;
  }

  private updateQualityScale(): void {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (this.qualityLastTime === 0) {
      this.qualityLastTime = now;
      return;
    }

    const dt = now - this.qualityLastTime;
    this.qualityLastTime = now;
    this.applyFirefoxLowFpsSafeguard(dt, now);

    if (dt <= 0 || dt > 120) return;

    this.qualityFrameTime = this.qualityFrameTime * 0.9 + dt * 0.1;
    if (this.qualityWarmupFrames < 15) {
      this.qualityWarmupFrames++;
      return;
    }

    const targetFrameMs = 16.67;
    const pressure = this.qualityFrameTime / targetFrameMs;

    if (pressure > 1.15) {
      this.qualityScale = Math.max(0.6, this.qualityScale - 0.05);
    } else if (pressure < 0.92) {
      this.qualityScale = Math.min(1, this.qualityScale + 0.03);
    }
  }

  private applyFirefoxLowFpsSafeguard(dt: number, now: number): void {
    if (!this.isFirefox) return;

    // Ignore tab/background pauses; only react to sustained live rendering stalls.
    if (dt <= 0 || dt > 2500) {
      this.firefoxLowFpsStreak = 0;
      return;
    }

    const isLowFpsFrame =
      dt >= FlowFieldRenderer.FIREFOX_LOW_FPS_FRAME_TIME_MS;
    if (!isLowFpsFrame) {
      this.firefoxLowFpsStreak = Math.max(0, this.firefoxLowFpsStreak - 2);
      return;
    }

    this.firefoxLowFpsStreak++;
    if (
      this.firefoxLowFpsStreak <
      FlowFieldRenderer.FIREFOX_LOW_FPS_REQUIRED_FRAMES
    ) {
      return;
    }

    if (
      now - this.firefoxLastContextResetAt <
      FlowFieldRenderer.FIREFOX_LOW_FPS_RESET_COOLDOWN_MS
    ) {
      return;
    }

    this.firefoxLastContextResetAt = now;
    this.firefoxLowFpsStreak = 0;
    this.qualityScale = Math.min(this.qualityScale, 0.6);
    this.qualityWarmupFrames = 0;
    this.resetCanvasState("firefox-low-fps");
  }

  private getAdaptiveDetailScale(
    pixelCount = this.width * this.height,
  ): number {
    const resolutionScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    return resolutionScale * this.qualityScale;
  }

  private getPatternContext(
    overrides?: Partial<FlowFieldPatternContext>,
  ): FlowFieldPatternContext {
    const base: FlowFieldPatternContext = {
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      centerX: this.centerX,
      centerY: this.centerY,
      time: this.time,
      hueBase: this.hueBase,
      TWO_PI: FlowFieldRenderer.TWO_PI,
      fastSin: (angle) => this.fastSin(angle),
      fastCos: (angle) => this.fastCos(angle),
      fastSqrt: (x) => this.fastSqrt(x),
      fastMod360: (x) => this.fastMod360(x),
      hsla: (h, s, l, a) => this.hsla(h, s, l, a),
    };

    return overrides ? { ...base, ...overrides } : base;
  }

  private initializeParticles(): void {
    const count = Math.min(
      this.particleCount,
      (this.width * this.height * 0.00125) | 0,
    );
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    const angle = Math.random() * FlowFieldRenderer.TWO_PI;
    const radius = Math.random() * Math.min(this.width, this.height) * 0.5;
    const maxLife = (150 + Math.random() * 250) | 0;

    return {
      x: this.centerX + this.fastCos(angle) * radius,
      y: this.centerY + this.fastSin(angle) * radius,
      vx: (Math.random() - 0.5) * (this.particleSpeed << 1),
      vy: (Math.random() - 0.5) * (this.particleSpeed << 1),
      size: (0.8 + Math.random() * 2.5) * this.particleSize,
      hue: (Math.random() * 360) | 0,
      life: maxLife,
      maxLife,
      angle: Math.random() * FlowFieldRenderer.TWO_PI,
      angularVelocity: (Math.random() - 0.5) * 0.15,
      trail: [],
    };
  }

  private initializeBubbles(): void {
    this.bubbles = [];
    const count = this.bubbleCount;

    for (let i = 0; i < count; i++) {
      this.bubbles.push(this.createBubble());
    }
  }

  private createBubble(): Bubble {
    const baseHue =
      FlowFieldRenderer.MYSTICAL_HUES[
        (Math.random() * FlowFieldRenderer.MYSTICAL_HUES.length) | 0
      ] ?? 270;
    const hue = baseHue + (Math.random() - 0.5) * 30;

    return {
      x: Math.random() * this.width,
      y: this.height + Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.3 * this.bubbleSpeed,
      vy: -(0.3 + Math.random() * 1.0) * this.bubbleSpeed,
      radius: (15 + Math.random() * 45) * this.bubbleSize,
      hue: ((hue % 360) + 360) & 0x1ff,
      age: 0,
      maxAge: (400 + Math.random() * 600) | 0,
      popping: false,
      popProgress: 0,
      symbolType: (Math.random() * 8) | 0,
      rotation: Math.random() * Math.PI * 2,
    };
  }

  private initializeStars(): void {
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * this.width * 2,
        y: (Math.random() - 0.5) * this.height * 2,
        z: Math.random() * 1000,
        size: Math.random() * 2,
      });
    }
  }

  private initializeMatrixColumns(): void {
    const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ01✦✧✩✪✫✬✭✮✯✰";
    this.matrixColumns = [];
    const columnCount = (this.width >> 4) + 1;

    for (let i = 0; i < columnCount; i++) {
      this.matrixColumns.push({
        y: Math.random() * this.height,
        speed: 2 + Math.random() * 6,
        chars: Array(25)
          .fill(0)
          .map(() => chars[(Math.random() * chars.length) | 0])
          .join(""),
      });
    }
  }

  private initializeConstellationStars(): void {
    this.constellationStars = [];
    const starCount = 20 + ((Math.random() * 15) | 0);

    for (let i = 0; i < starCount; i++) {
      this.constellationStars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        connections: [],
      });
    }

    for (let i = 0; i < this.constellationStars.length; i++) {
      const star = this.constellationStars[i];
      if (!star) continue;

      const distances: { index: number; dist: number }[] = [];
      for (let j = 0; j < this.constellationStars.length; j++) {
        if (i === j) continue;
        const other = this.constellationStars[j];
        if (!other) continue;

        const dx = other.x - star.x;
        const dy = other.y - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        distances.push({ index: j, dist });
      }

      distances.sort((a, b) => a.dist - b.dist);
      star.connections = distances.slice(0, 3).map((d) => d.index);
    }
  }

  private updatePatternTransition(audioIntensity: number): void {
    const dynamicDuration = Math.max(
      150,
      this.patternDuration - audioIntensity * 200,
    );

    this.patternTimer++;

    if (!this.hasLoggedInitialPattern) {
      this.logPatternChange(this.currentPattern, "playing");
      this.hasLoggedInitialPattern = true;
    }

    if (this.isTransitioning) {
      const rawProgress =
        this.transitionProgress +
        this.transitionSpeed * (1 + audioIntensity * 0.3);
      this.transitionProgress = Math.min(1, rawProgress);

      if (this.transitionProgress >= 1) {
        this.transitionProgress = 0;
        this.isTransitioning = false;
        const previousPattern = this.currentPattern;
        this.currentPattern = this.nextPattern;
        this.patternTimer = 0;

        if (previousPattern !== this.currentPattern) {
          this.logPatternChange(this.currentPattern, "transitioned-to");

          // Increment pattern counter and perform deep reset every 10 patterns
          this.patternsSinceReset++;
          if (this.patternsSinceReset >= 10) {
            this.resetCanvasState();
            this.patternsSinceReset = 0;
          }
        }
      }
    } else if (this.patternTimer > dynamicDuration) {
      this.isTransitioning = true;
      this.transitionProgress = 0;
      this.patternIndex = (this.patternIndex + 1) % this.patternSequence.length;

      if (this.patternIndex === 0) {
        this.shufflePatterns();
      }

      this.nextPattern = this.patternSequence[this.patternIndex] ?? "rays";

      this.logPatternChange(this.nextPattern, "transitioning-to");
    }
  }

  private renderFractal(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    if (
      !this.fractalImageData ||
      this.fractalImageDataWidth !== this.width ||
      this.fractalImageDataHeight !== this.height
    ) {
      this.fractalImageData = ctx.createImageData(this.width, this.height);
      this.fractalImageDataWidth = this.width;
      this.fractalImageDataHeight = this.height;
    }
    const imageData = this.fractalImageData;
    const data = imageData.data;

    this.juliaC.re =
      -0.7 + this.fastSin(this.time * 0.001) * 0.2 + bassIntensity * 0.1;
    this.juliaC.im =
      0.27 + this.fastCos(this.time * 0.0015) * 0.2 + midIntensity * 0.1;

    this.fractalZoom +=
      (0.02 + audioIntensity * 0.05) *
      (1 + this.fastSin(this.time * 0.002) * 0.5);

    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const maxIter = Math.max(
      12,
      Math.min(40, ((24 + ((audioIntensity * 20) | 0)) * detailScale) | 0),
    );
    const zoom = Math.pow(1.5, this.fractalZoom);

    const scaleX = 1 / (this.width * 0.25 * zoom);
    const scaleY = 1 / (this.height * 0.25 * zoom);
    const juliaRe = this.juliaC.re;
    const juliaIm = this.juliaC.im;
    const invMaxIter = 1 / maxIter;
    const timeWave = this.fastSin(this.time * 0.002) * 60;

    const stepBoost = pixelCount > 500_000 ? 1 : 0;
    const baseStep = (audioIntensity > 0.75 ? 2 : 3) + stepBoost;
    const step = Math.max(1, Math.round(baseStep / detailScale));

    for (let py = 0; py < this.height; py += step) {
      for (let px = 0; px < this.width; px += step) {
        const x0 = (px - this.centerX) * scaleX + this.fractalOffsetX;
        const y0 = (py - this.centerY) * scaleY + this.fractalOffsetY;

        let x = x0;
        let y = y0;
        let iter = 0;

        while (iter < maxIter - 1) {
          const xSq = x * x;
          const ySq = y * y;
          if (xSq + ySq > 4) break;

          const xtemp = xSq - ySq + juliaRe;
          y = (x + x) * y + juliaIm;
          x = xtemp;
          iter++;

          const xSq2 = x * x;
          const ySq2 = y * y;
          if (xSq2 + ySq2 > 4) break;

          const xtemp2 = xSq2 - ySq2 + juliaRe;
          y = (x + x) * y + juliaIm;
          x = xtemp2;
          iter++;
        }

        const iterRatio = iter * invMaxIter;
        const hue =
          (this.hueBase + iterRatio * 720 + bassIntensity * 90 + timeWave) %
          360;
        const saturation = 60 + audioIntensity * 40;
        const lightness =
          iter < maxIter
            ? iterRatio * 70 + this.fastSin(iterRatio * Math.PI * 3) * 15
            : 0;

        const rgb = this.cachedHslToRgb(
          hue / 360,
          saturation / 100,
          lightness / 100,
        );

        const r = rgb[0] ?? 0;
        const g = rgb[1] ?? 0;
        const b = rgb[2] ?? 0;

        for (let dy = 0; dy < step && py + dy < this.height; dy++) {
          for (let dx = 0; dx < step && px + dx < this.width; dx++) {
            const i = ((py + dy) * this.width + (px + dx)) << 2;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private renderRays(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const baseRayCount = this.rayCount;
    const countScale = 0.65 + audioIntensity * 0.55 + bassIntensity * 0.55;
    let rayCount = (baseRayCount * countScale) | 0;
    if (rayCount < 24) rayCount = 24;
    if (rayCount > 120) rayCount = 120;
    const invRayCount = 1 / rayCount;
    const angleStep = twoPi * invRayCount;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);
    ctx.lineCap = "round";

    const timeWave1 = this.time * 0.001;
    const timeWave2 = this.time * 0.01;
    const timeWave3 = this.time * 0.005;
    const timeHue = this.time * 0.05;
    const minDimension = Math.min(this.width, this.height);

    const rayLengthBase = minDimension * (0.55 + audioIntensity * 0.55);
    const rayWidth = 2.5 + trebleIntensity * 5.5;
    const hueStep = 360 * invRayCount;
    const alpha = 0.4 + audioIntensity * 0.45;

    const rayData: Array<{ endX: number; endY: number; hue: number }> = [];

    for (let i = 0; i < rayCount; i++) {
      const spiralAngle = timeWave1 + i * 0.1;
      const pulseAngle = timeWave2 + i * 0.2;
      const angle =
        angleStep * i + timeWave3 + this.fastSin(spiralAngle) * 0.18;
      const pulseEffect = 1 + this.fastSin(pulseAngle) * 0.12;
      const rayLength = rayLengthBase * pulseEffect;

      const endX = this.fastCos(angle) * rayLength;
      const endY = this.fastSin(angle) * rayLength;
      const hue = this.fastMod360(this.hueBase + i * hueStep + timeHue);

      rayData.push({ endX, endY, hue });
    }

    ctx.shadowBlur = 0;
    ctx.lineWidth = rayWidth;

    for (let i = 0; i < rayCount; i++) {
      const { endX, endY, hue } = rayData[i]!;
      ctx.strokeStyle = this.hsla(hue, 95, 65, alpha);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    const glowRadius = 90 + bassIntensity * 110;
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glowGradient.addColorStop(
      0,
      this.hsla(this.hueBase, 100, 80, 0.35 + audioIntensity * 0.25),
    );
    glowGradient.addColorStop(
      0.55,
      this.hsla(this.hueBase, 90, 60, 0.18 + audioIntensity * 0.15),
    );
    glowGradient.addColorStop(1, this.hsla(this.hueBase, 80, 40, 0));

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderTunnel(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const rings = 30;
    const segments = 48;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const invRings = 1 / rings;
    const angleStep = FlowFieldRenderer.TWO_PI / segments;
    const maxDimension = Math.max(this.width, this.height) * 2;

    for (let r = 0; r < rings; r++) {
      const depth = r * invRings;
      const z =
        depth + this.time * 0.003 * this.tunnelSpeed + bassIntensity * 0.1;
      const zMod = z % 1;
      const scale = 1 / (zMod + 0.1);
      const radius = scale * 50;

      if (radius > maxDimension) continue;

      const alpha = (1 - zMod) * (0.2 + audioIntensity * 0.3);
      const rotation = z * FlowFieldRenderer.TWO_PI + midIntensity * Math.PI;

      ctx.beginPath();

      for (let s = 0; s <= segments; s++) {
        const angle = angleStep * s + rotation;
        const x = this.centerX + this.fastCos(angle) * radius;
        const y = this.centerY + this.fastSin(angle) * radius;

        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();

      const hue = (this.hueBase + depth * 360 + bassIntensity * 60) % 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.lineWidth = 1 + audioIntensity * 3;
      ctx.stroke();

      if (r % 3 === 0) {
        const gradient = ctx.createRadialGradient(
          this.centerX,
          this.centerY,
          radius * 0.7,
          this.centerX,
          this.centerY,
          radius,
        );
        gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0)`);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, ${alpha * 0.3})`);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawOccultSymbol(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    symbolType: number,
    rotation: number,
    hue: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `hsla(${hue}, 90%, 70%, ${alpha})`;
    ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha * 0.2})`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (symbolType & 7) {
      case 0:
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = size * 0.4;
          const x1 = Math.cos(angle) * r;
          const y1 = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 1:
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(0, size * 0.5);
        ctx.moveTo(-size * 0.2, -size * 0.3);
        ctx.lineTo(size * 0.2, -size * 0.3);
        ctx.moveTo(-size * 0.15, size * 0.2);
        ctx.lineTo(size * 0.15, size * 0.2);
        ctx.stroke();
        break;

      case 2:
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const r = size * 0.4;
          const x1 = Math.cos(angle) * r;
          const y1 = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.PI / 6 - Math.PI / 2;
          const r = size * 0.4;
          const x1 = Math.cos(angle) * r;
          const y1 = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
        break;

      case 3:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(angle) * size * 0.35,
            Math.sin(angle) * size * 0.35,
          );
          ctx.stroke();
        }
        break;

      case 4:
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.4, size * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${alpha})`;
        ctx.fill();
        break;

      case 5:
        ctx.beginPath();
        ctx.arc(0, -size * 0.2, size * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(0, size * 0.5);
        ctx.moveTo(-size * 0.25, size * 0.2);
        ctx.lineTo(size * 0.25, size * 0.2);
        ctx.stroke();
        break;

      case 6:
        ctx.beginPath();
        ctx.arc(-size * 0.25, 0, size * 0.15, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.2, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(size * 0.25, 0, size * 0.15, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
        break;

      case 7:
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(-size * 0.35, size * 0.3);
        ctx.lineTo(size * 0.35, size * 0.3);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, size * 0.3);
        ctx.lineTo(0, -size * 0.2);
        ctx.moveTo(-size * 0.2, size * 0.05);
        ctx.lineTo(size * 0.2, size * 0.05);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  private renderBubbles(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    if (bassIntensity > 0.4 && Math.random() > 0.85) {
      this.bubbles.push(this.getBubbleFromPool());
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      if (!bubble) continue;

      if (bubble.popping) {
        bubble.popProgress += 0.08 + trebleIntensity * 0.08;

        if (bubble.popProgress >= 1) {
          this.returnBubbleToPool(bubble);
          this.bubbles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const particleCount = 16;
        const dist = bubble.radius * bubble.popProgress * 2.5;
        const angleStep = FlowFieldRenderer.TWO_PI / particleCount;

        for (let s = 0; s < particleCount; s++) {
          const angle = angleStep * s;
          const x = bubble.x + this.fastCos(angle) * dist;
          const y = bubble.y + this.fastSin(angle) * dist;

          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
          gradient.addColorStop(
            0,
            `hsla(${bubble.hue}, 100%, 60%, ${(1 - bubble.popProgress) * 0.8})`,
          );
          gradient.addColorStop(1, `hsla(${bubble.hue}, 80%, 40%, 0)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(x - 8, y - 8, 16, 16);
        }

        ctx.restore();
      } else {
        bubble.age++;
        bubble.rotation += 0.01 + audioIntensity * 0.008;

        bubble.vy -= 0.008;
        bubble.vx += (Math.random() - 0.5) * 0.06;
        bubble.vx *= 0.98;
        bubble.vy *= 0.98;

        const timePhase = this.time * 0.015;
        const spiralX =
          this.fastSin(timePhase + bubble.y * 0.01) * 0.4 +
          this.fastCos(timePhase * 1.3 + bubble.age * 0.005) * 0.2;
        const spiralY = this.fastSin(timePhase * 0.7 + bubble.x * 0.008) * 0.15;

        bubble.x += bubble.vx + spiralX;
        bubble.y += bubble.vy + spiralY;

        if (
          bubble.age > bubble.maxAge ||
          bubble.y < -bubble.radius * 2 ||
          bubble.x < -bubble.radius ||
          bubble.x > this.width + bubble.radius ||
          (trebleIntensity > 0.75 && Math.random() > 0.97)
        ) {
          bubble.popping = true;
          continue;
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const breathe =
          1 + this.fastSin(this.time * 0.003 + bubble.age * 0.01) * 0.2;
        const outerGlow = ctx.createRadialGradient(
          bubble.x,
          bubble.y,
          bubble.radius * 0.5,
          bubble.x,
          bubble.y,
          bubble.radius * 2.5 * breathe,
        );

        const glowHue = (bubble.hue + this.time * 0.05) % 360;
        outerGlow.addColorStop(
          0,
          `hsla(${glowHue}, 100%, 55%, ${0.18 + audioIntensity * 0.12})`,
        );
        outerGlow.addColorStop(
          0.4,
          `hsla(${(bubble.hue + 30) % 360}, 90%, 40%, ${0.08 + audioIntensity * 0.05})`,
        );
        outerGlow.addColorStop(
          1,
          `hsla(${(bubble.hue + 60) % 360}, 80%, 30%, 0)`,
        );

        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        const orbGradient = ctx.createRadialGradient(
          bubble.x - bubble.radius * 0.2,
          bubble.y - bubble.radius * 0.2,
          bubble.radius * 0.1,
          bubble.x,
          bubble.y,
          bubble.radius,
        );
        orbGradient.addColorStop(
          0,
          `hsla(${bubble.hue}, 85%, 45%, ${0.25 + audioIntensity * 0.15})`,
        );
        orbGradient.addColorStop(
          0.3,
          `hsla(${(bubble.hue + 20) % 360}, 80%, 35%, ${0.2 + audioIntensity * 0.1})`,
        );
        orbGradient.addColorStop(
          0.7,
          `hsla(${(bubble.hue + 40) % 360}, 75%, 25%, ${0.15 + audioIntensity * 0.08})`,
        );
        orbGradient.addColorStop(
          1,
          `hsla(${(bubble.hue + 60) % 360}, 70%, 20%, ${0.1 + audioIntensity * 0.05})`,
        );

        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();

        const innerGlow = ctx.createRadialGradient(
          bubble.x - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          0,
          bubble.x - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          bubble.radius * 0.5,
        );
        innerGlow.addColorStop(
          0,
          `hsla(${bubble.hue}, 100%, 60%, ${0.3 + audioIntensity * 0.2})`,
        );
        innerGlow.addColorStop(1, `hsla(${bubble.hue}, 90%, 50%, 0)`);

        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(
          bubble.x - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          bubble.radius * 0.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const symbolAlpha = 0.6 + audioIntensity * 0.3;
        this.drawOccultSymbol(
          ctx,
          bubble.x,
          bubble.y,
          bubble.radius * 0.7,
          bubble.symbolType,
          bubble.rotation,
          bubble.hue,
          symbolAlpha,
        );

        ctx.restore();
      }
    }
  }

  private renderWaves(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const waveCount = Math.max(3, (this.waveCount * detailScale) | 0);
    const amplitude = (50 + audioIntensity * 100) * this.waveAmplitude;
    const frequency = 0.02 + trebleIntensity * 0.03;
    const time = this.time;
    const time02 = time * 0.02;
    const time01 = time * 0.01;
    const time005 = time * 0.05;
    const time003 = time * 0.03;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let w = 0; w < waveCount; w++) {
      const phase = time02 + (w * Math.PI) / waveCount;
      const baseRadius = 50 + (w << 6) - (w << 2);

      ctx.beginPath();

      const steps = Math.max(96, (157 * detailScale) | 0);
      const angleStep = FlowFieldRenderer.TWO_PI / steps;

      for (let i = 0; i <= steps; i++) {
        const angle = angleStep * i;
        const wave1 =
          this.fastSin(angle * 8 + phase) * amplitude * bassIntensity;
        const wave2 =
          this.fastCos(angle * 5 - phase * 0.7) *
          amplitude *
          0.3 *
          trebleIntensity;
        const wave3 = this.fastSin(angle * 12 + phase * 1.5) * amplitude * 0.15;
        const r = baseRadius + wave1 + wave2 + wave3;
        const x = this.centerX + this.fastCos(angle) * r;
        const y = this.centerY + this.fastSin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();

      const hue =
        ((this.hueBase + (w << 6) + (w << 3) + this.time * 0.1) % 360) | 0;
      const alpha = 0.25 + audioIntensity * 0.35;

      ctx.strokeStyle = `hsla(${hue}, 95%, 68%, ${alpha})`;
      ctx.lineWidth = 2 + audioIntensity * 5;
      ctx.stroke();

      const gradient = ctx.createRadialGradient(
        this.centerX,
        this.centerY,
        baseRadius * 0.8,
        this.centerX,
        this.centerY,
        baseRadius + amplitude,
      );
      gradient.addColorStop(0, `hsla(${hue}, 85%, 65%, 0)`);
      gradient.addColorStop(
        0.3,
        `hsla(${hue + 30}, 90%, 70%, ${alpha * 0.25})`,
      );
      gradient.addColorStop(0.7, `hsla(${hue}, 80%, 60%, ${alpha * 0.15})`);
      gradient.addColorStop(1, `hsla(${hue - 20}, 75%, 55%, 0)`);

      ctx.fillStyle = gradient;
      ctx.fill();
    }

    let gridSize = 48;
    if (pixelCount > 900_000) gridSize = 80;
    else if (pixelCount > 700_000) gridSize = 64;
    else if (pixelCount > 500_000) gridSize = 56;
    ctx.globalAlpha = 0.18 + audioIntensity * 0.25;
    const drawHighlights = detailScale >= 0.85;

    for (let y = 0; y < this.height; y += gridSize) {
      for (let x = 0; x < this.width; x += gridSize) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distSq = dx * dx + dy * dy;
        const dist = this.fastSqrt(distSq);

        const wave1 =
          this.fastSin(dist * frequency - time005) * 10 * trebleIntensity;
        const wave2 =
          this.fastCos(dist * frequency * 0.7 + time003) * 5 * bassIntensity;
        const wave = wave1 + wave2;

        const hue = ((this.hueBase + (dist >> 1) + time * 0.08) % 360) | 0;
        const absWave = wave < 0 ? -wave : wave;
        const size = (2 + absWave) | 0;

        const pointAlpha = 0.5 + this.fastSin(time01 + dist * 0.02) * 0.3;
        ctx.fillStyle = `hsla(${hue}, 85%, 72%, ${pointAlpha})`;
        ctx.fillRect((x + wave) | 0, (y + wave) | 0, size, size);

        if (drawHighlights && (x & 0x3f) === 0 && (y & 0x3f) === 0) {
          ctx.fillStyle = `hsla(${hue + 30}, 100%, 80%, ${pointAlpha * 0.3})`;
          ctx.fillRect(
            (x + wave - 2) | 0,
            (y + wave - 2) | 0,
            (size << 1) + 2,
            (size << 1) + 2,
          );
        }
      }
    }

    ctx.restore();
  }

  private renderSwarm(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    this.updateSpatialGrid();

    const perceptionRadius = 50 + audioIntensity * 50;
    const perceptionRadiusSq = perceptionRadius * perceptionRadius;
    const separationDistSq = 900;
    const centerForce = 0.001 * (1 + bassIntensity * 2);
    const maxSpeed = 2 + trebleIntensity * 3;
    const maxSpeedSq = maxSpeed * maxSpeed;

    for (const particle of this.particles) {
      if (!particle) continue;

      let alignX = 0,
        alignY = 0;
      let cohereX = 0,
        cohereY = 0;
      let separateX = 0,
        separateY = 0;
      let neighbors = 0;

      const nearbyParticles = this.getNearbyParticles(particle);

      for (const other of nearbyParticles) {
        if (other === particle) continue;

        const dx = other.x - particle.x;
        const dy = other.y - particle.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < perceptionRadiusSq && distSq > 0) {
          alignX += other.vx;
          alignY += other.vy;

          cohereX += other.x;
          cohereY += other.y;

          if (distSq < separationDistSq) {
            const dist = this.fastSqrt(distSq);
            const invDist = 1 / dist;
            separateX -= dx * invDist;
            separateY -= dy * invDist;
          }

          neighbors++;
        }
      }

      if (neighbors > 0) {
        const invNeighbors = 1 / neighbors;
        alignX *= invNeighbors;
        alignY *= invNeighbors;
        cohereX = (cohereX * invNeighbors - particle.x) * 0.01;
        cohereY = (cohereY * invNeighbors - particle.y) * 0.01;
        separateX *= 0.05;
        separateY *= 0.05;
      }

      const dx = this.centerX - particle.x;
      const dy = this.centerY - particle.y;
      const distSq = dx * dx + dy * dy;
      const dist = this.fastSqrt(distSq);
      const invDist = 1 / dist;

      particle.vx +=
        alignX * 0.02 + cohereX + separateX + dx * invDist * centerForce;
      particle.vy +=
        alignY * 0.02 + cohereY + separateY + dy * invDist * centerForce;

      const speedSq = particle.vx * particle.vx + particle.vy * particle.vy;
      if (speedSq > maxSpeedSq) {
        const invSpeed = maxSpeed / this.fastSqrt(speedSq);
        particle.vx *= invSpeed;
        particle.vy *= invSpeed;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0) particle.x = this.width;
      if (particle.x > this.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.height;
      if (particle.y > this.height) particle.y = 0;

      particle.trail.push({ x: particle.x, y: particle.y, alpha: 1 });
      if (particle.trail.length > 20) particle.trail.shift();

      if (particle.trail.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();

        const firstPoint = particle.trail[0];
        if (firstPoint) {
          ctx.moveTo(firstPoint.x, firstPoint.y);

          for (let t = 1; t < particle.trail.length; t++) {
            const point = particle.trail[t];
            if (point) ctx.lineTo(point.x, point.y);
          }

          const hue = (this.hueBase + particle.hue) % 360;
          const gradient = ctx.createLinearGradient(
            firstPoint.x,
            firstPoint.y,
            particle.x,
            particle.y,
          );
          gradient.addColorStop(0, `hsla(${hue}, 90%, 60%, 0)`);
          gradient.addColorStop(
            1,
            `hsla(${hue}, 95%, 70%, ${0.4 + audioIntensity * 0.3})`,
          );

          ctx.strokeStyle = gradient;
          ctx.lineWidth = particle.size;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const hue = (this.hueBase + particle.hue) % 360;
      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.size * 3,
      );
      gradient.addColorStop(
        0,
        `hsla(${hue}, 100%, 80%, ${0.6 + audioIntensity * 0.4})`,
      );
      gradient.addColorStop(
        0.5,
        `hsla(${hue}, 95%, 70%, ${0.3 + audioIntensity * 0.2})`,
      );
      gradient.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(
        particle.x - particle.size * 3,
        particle.y - particle.size * 3,
        particle.size * 6,
        particle.size * 6,
      );

      ctx.restore();
    }
  }

  private renderMandala(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const layers = 3;
    const symmetry = 6;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const symmetryAngleStep = FlowFieldRenderer.TWO_PI / symmetry;
    const petals = 4;
    const petalAngleStep = FlowFieldRenderer.TWO_PI / petals;

    for (let layer = 0; layer < layers; layer++) {
      const radius = 50 + layer * 60 + bassIntensity * 40;
      const rotation =
        this.time * 0.001 * (layer % 2 === 0 ? 1 : -1) + midIntensity * Math.PI;

      for (let sym = 0; sym < symmetry; sym++) {
        ctx.save();
        ctx.rotate(symmetryAngleStep * sym);

        for (let p = 0; p < petals; p++) {
          const angle = petalAngleStep * p + rotation;
          const petalRadius = radius * 0.3;
          const x = this.fastCos(angle) * radius;
          const y = this.fastSin(angle) * radius;

          const hue = (this.hueBase + layer * 45 + sym * 30) % 360;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, petalRadius);
          gradient.addColorStop(
            0,
            `hsla(${hue}, 90%, 70%, ${0.4 + audioIntensity * 0.3})`,
          );
          gradient.addColorStop(
            0.7,
            `hsla(${hue}, 85%, 65%, ${0.2 + audioIntensity * 0.15})`,
          );
          gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.ellipse(
            x,
            y,
            petalRadius,
            petalRadius * 0.5,
            angle,
            0,
            Math.PI << 1,
          );
          ctx.fill();
        }

        ctx.restore();
      }

      if (layer % 2 === 0 && layer > 0) {
        const symbolRadius = 50 + layer * 60;
        const clanCount = 5;
        for (let c = 0; c < clanCount; c++) {
          const angle = (c / clanCount) * Math.PI * 2 + rotation * 0.5;
          const x = Math.cos(angle) * symbolRadius;
          const y = Math.sin(angle) * symbolRadius;
          const hue = (this.hueBase + c * 27.7) % 360;
          const alpha = 0.15 + audioIntensity * 0.15;

          this.drawClanSymbol(
            ctx,
            x,
            y,
            20 + bassIntensity * 10,
            c,
            alpha,
            hue,
          );
        }
      }
    }

    ctx.restore();
  }

  private renderDNA(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const helixCount = 2;
    const segments = 100;
    const amplitude = 150 + bassIntensity * 100;
    const wavelength = this.height / 3;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const invSegments = 1 / segments;
    const wavelengthFactor = FlowFieldRenderer.TWO_PI / wavelength;

    for (let h = 0; h < helixCount; h++) {
      const phase = h * Math.PI + this.time * 0.02;

      ctx.beginPath();

      for (let i = 0; i <= segments; i++) {
        const t = i * invSegments;
        const y = t * this.height;
        const angle = y * wavelengthFactor + phase;
        const x = this.centerX + this.fastSin(angle) * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        if (h === 0 && i % 5 === 0) {
          const angle2 = angle + Math.PI;
          const x2 = this.centerX + this.fastSin(angle2) * amplitude;

          const hue = (this.hueBase + (i / segments) * 360) % 360;
          ctx.save();
          ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.3 + audioIntensity * 0.3})`;
          ctx.lineWidth = 2 + trebleIntensity * 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y);
          ctx.stroke();

          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
          gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.7)`);
          gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(x - 8, y - 8, 16, 16);

          const gradient2 = ctx.createRadialGradient(x2, y, 0, x2, y, 8);
          gradient2.addColorStop(
            0,
            `hsla(${(hue + 180) % 360}, 90%, 70%, 0.7)`,
          );
          gradient2.addColorStop(1, `hsla(${(hue + 180) % 360}, 80%, 60%, 0)`);
          ctx.fillStyle = gradient2;
          ctx.fillRect(x2 - 8, y - 8, 16, 16);

          ctx.restore();
        }
      }

      const hue = (this.hueBase + h * 180) % 360;
      ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${0.4 + audioIntensity * 0.3})`;
      ctx.lineWidth = 3 + audioIntensity * 4;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderGalaxy(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const arms = 4;
    const rotationSpeed = this.time * 0.001 + bassIntensity * 0.05;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const coreGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      80 + bassIntensity * 60,
    );
    coreGradient.addColorStop(0, `hsla(${this.hueBase}, 100%, 90%, 0.8)`);
    coreGradient.addColorStop(0.3, `hsla(${this.hueBase}, 90%, 70%, 0.5)`);
    coreGradient.addColorStop(1, `hsla(${this.hueBase}, 80%, 50%, 0)`);
    ctx.fillStyle = coreGradient;
    ctx.fillRect(-100, -100, 200, 200);

    const maxRadius = Math.min(this.width, this.height) * 0.6;
    const armAngleStep = FlowFieldRenderer.TWO_PI / arms;

    for (let arm = 0; arm < arms; arm++) {
      const armAngle = armAngleStep * arm;

      for (let r = 20; r < maxRadius; r += 5) {
        const spiralTightness = 0.3;
        const angle = armAngle + r * spiralTightness * 0.01 + rotationSpeed;
        const x = this.fastCos(angle) * r;
        const y = this.fastSin(angle) * r;

        if (Math.random() > 0.3) {
          const starSize = 1 + Math.random() * 3 + audioIntensity * 2;
          const hue = (this.hueBase + r / 2 + arm * 90) % 360;
          const alpha = 0.3 + Math.random() * 0.5 + midIntensity * 0.3;

          const starGradient = ctx.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            starSize * 2,
          );
          starGradient.addColorStop(0, `hsla(${hue}, 100%, 90%, ${alpha})`);
          starGradient.addColorStop(
            0.5,
            `hsla(${hue}, 90%, 70%, ${alpha * 0.5})`,
          );
          starGradient.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);

          ctx.fillStyle = starGradient;
          ctx.fillRect(
            x - starSize * 2,
            y - starSize * 2,
            starSize * 4,
            starSize * 4,
          );
        }

        if (r % 80 === 0) {
          const clanIndex = ((r * 0.0125) | 0) % 13;
          const symbolAlpha = 0.12 + audioIntensity * 0.18;
          this.drawClanSymbol(
            ctx,
            x,
            y,
            30 + bassIntensity * 20,
            clanIndex,
            symbolAlpha,
            (this.hueBase + arm * 90) % 360,
          );
        }
      }
    }

    ctx.restore();
  }

  private renderMatrix(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    if (this.matrixColumns.length === 0) {
      this.initializeMatrixColumns();
    }

    ctx.save();
    ctx.font = "16px monospace";
    ctx.globalCompositeOperation = "lighter";

    const invMatrixColumnsLength = 1 / this.matrixColumns.length;
    const speedMultiplier = 1 + bassIntensity * 2;
    const baseHue = this.fastMod360(this.hueBase + 120);
    const audioAlpha = 0.5 + audioIntensity * 0.5;
    const charSpacing = 20;

    for (let i = 0; i < this.matrixColumns.length; i++) {
      const col = this.matrixColumns[i];
      if (!col) continue;

      const x = i * invMatrixColumnsLength * this.width;
      col.y += col.speed * speedMultiplier;

      if (col.y > this.height + 100) {
        col.y = -100;
      }

      const invCharsLength = 1 / col.chars.length;
      for (let c = 0; c < col.chars.length; c++) {
        const char = col.chars[c];
        const y = col.y + c * charSpacing;
        const alpha = 1 - c * invCharsLength * 0.8;
        const lightness = 50 + (c << 1);

        ctx.fillStyle = this.hsla(baseHue, 90, lightness, alpha * audioAlpha);
        ctx.fillText(char ?? "", x, y);

        if (c === 0) {
          ctx.fillStyle = this.hsla(
            baseHue,
            100,
            90,
            0.9 + trebleIntensity * 0.1,
          );
          ctx.fillText(char ?? "", x, y);
        }
      }
    }

    ctx.restore();
  }

  private renderLightning(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    const shouldSpawn =
      (bassIntensity > 0.6 && (this.time & 7) === 0) ||
      this.lightningBolts.length < 2;
    const trebleMultiplier = 1 + trebleIntensity;
    const hue = this.fastMod360(this.hueBase + 180);

    if (shouldSpawn) {
      const rng1 = ((this.time * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const startX = rng1 * this.width;
      const startY = 0;
      const targetY = this.height;

      const segments: { x: number; y: number }[] = [{ x: startX, y: startY }];
      let currentX = startX;
      let currentY = startY;
      let rngSeed = this.time;

      while (currentY < targetY) {
        rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
        const rng = rngSeed / 0x7fffffff;
        currentY += 20 + rng * 40;

        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const rng2 = rngSeed / 0x7fffffff;
        currentX += (rng2 - 0.5) * 60 * trebleMultiplier;
        segments.push({ x: currentX, y: currentY });
      }

      rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
      const maxLifeRng = rngSeed / 0x7fffffff;
      this.lightningBolts.push({
        segments,
        life: 0,
        maxLife: 15 + maxLifeRng * 15,
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      if (!bolt) continue;

      bolt.life++;

      if (bolt.life > bolt.maxLife) {
        this.lightningBolts.splice(i, 1);
        continue;
      }

      const invMaxLife = 1 / bolt.maxLife;
      const alpha = 1 - bolt.life * invMaxLife;
      const strokeAlpha1 = alpha * (0.8 + audioIntensity * 0.2);
      const strokeAlpha2 = alpha * 0.4;
      const lineWidth1 = 3 + audioIntensity * 4;
      const lineWidth2 = 8 + audioIntensity * 10;

      ctx.beginPath();
      const segCount = bolt.segments.length;
      for (let s = 0; s < segCount; s++) {
        const seg = bolt.segments[s];
        if (!seg) continue;

        if (s === 0) {
          ctx.moveTo(seg.x, seg.y);
        } else {
          ctx.lineTo(seg.x, seg.y);
        }
      }

      ctx.strokeStyle = this.hsla(hue, 100, 90, strokeAlpha1);
      ctx.lineWidth = lineWidth1;
      ctx.stroke();

      ctx.strokeStyle = this.hsla(hue, 80, 70, strokeAlpha2);
      ctx.lineWidth = lineWidth2;
      ctx.stroke();

      if (bolt.life < 5) {
        let rngSeed = (this.time + i) * 1103515245;
        for (let s = 1; s < segCount - 1; s += 3) {
          const seg = bolt.segments[s];
          if (!seg) continue;

          rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
          if (rngSeed / 0x7fffffff > 0.5) continue;

          rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
          const rng1 = rngSeed / 0x7fffffff;
          rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
          const rng2 = rngSeed / 0x7fffffff;

          ctx.beginPath();
          ctx.moveTo(seg.x, seg.y);
          ctx.lineTo(seg.x + (rng1 - 0.5) * 100, seg.y + 50 + rng2 * 50);
          ctx.strokeStyle = this.hsla(hue, 90, 80, alpha * 0.5);
          ctx.lineWidth = 1 + audioIntensity * 2;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  private renderFireworks(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const shouldSpawn = bassIntensity > 0.5 && (this.time & 15) === 0;

    if (shouldSpawn) {
      let rngSeed = (this.time * 1103515245 + 12345) & 0x7fffffff;
      const rng1 = rngSeed / 0x7fffffff;
      rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
      const rng2 = rngSeed / 0x7fffffff;
      rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
      const rng3 = rngSeed / 0x7fffffff;

      const hue = rng1 * 360;
      const x = this.width * (0.3 + rng2 * 0.4);
      const y = this.height * (0.3 + rng3 * 0.3);
      const particleCount = 30 + ((bassIntensity * 40) | 0); // Reduced from 50 + 100
      const invParticleCount = 1 / particleCount;
      const twoPi = FlowFieldRenderer.TWO_PI;

      for (let i = 0; i < particleCount; i++) {
        const angle = i * invParticleCount * twoPi;
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const speedRng = rngSeed / 0x7fffffff;
        const speed = 2 + speedRng * 6 + trebleIntensity * 5;

        rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
        const hueRng = rngSeed / 0x7fffffff;
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const lifeRng = rngSeed / 0x7fffffff;
        rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
        const sizeRng = rngSeed / 0x7fffffff;

        let particle = this.fireworksPool.pop();
        particle ??= {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          hue: 0,
          life: 0,
          maxLife: 0,
          size: 0,
          dead: false,
        };

        particle.x = x;
        particle.y = y;
        particle.vx = this.fastCos(angle) * speed;
        particle.vy = this.fastSin(angle) * speed;
        particle.hue = hue + (hueRng - 0.5) * 60;
        particle.life = 0;
        particle.maxLife = 60 + lifeRng * 60;
        particle.size = 1 + sizeRng * 2;
        particle.dead = false;

        this.fireworks.push(particle);
        this.fireworksActiveCount++;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const gravity = 0.15;
    const friction = 0.98;
    const len = this.fireworks.length;

    // Firefox optimization: Use rectangles instead of arcs (much faster)
    // and cache color strings to reduce string creation overhead
    for (let i = 0; i < len; i++) {
      const fw = this.fireworks[i];
      if (!fw || fw.dead) continue;

      fw.life++;
      fw.vy += gravity;
      fw.vx *= friction;
      fw.vy *= friction;
      fw.x += fw.vx;
      fw.y += fw.vy;

      if (fw.life > fw.maxLife) {
        fw.dead = true;
        this.fireworksActiveCount--;
        this.fireworksPool.push(fw);
        continue;
      }

      const invMaxLife = 1 / fw.maxLife;
      const alpha = 1 - fw.life * invMaxLife;
      const size = fw.size * 2.2;

      ctx.fillStyle = this.hsla(fw.hue, 95, 70, alpha * 0.65);

      // Use fillRect instead of arc (3-4x faster in Firefox for small particles)
      ctx.fillRect(fw.x - size, fw.y - size, size * 2, size * 2);
    }

    ctx.restore();

    this.fireworksCleanupCounter++;
    if (this.fireworksCleanupCounter > 120) {
      this.fireworksCleanupCounter = 0;
      this.fireworks = this.fireworks.filter((fw) => !fw.dead);
    }
  }

  private renderLissajous(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const curves = 2;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const minDimension = Math.min(this.width, this.height);
    const timeDelta = this.time * 0.01;
    const bassMultiplier = 1 + bassIntensity;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const stepSize = 0.08;

    for (let c = 0; c < curves; c++) {
      const a = 3 + c;
      const b = 4 + c;
      const delta = (timeDelta + c) * bassMultiplier;
      const scale = minDimension * 0.3 * (1 + audioIntensity * 0.3);
      const negScale = -scale;

      ctx.beginPath();

      for (let t = 0; t <= twoPi; t += stepSize) {
        const x = this.fastSin(a * t + delta) * scale;
        const y = this.fastSin(b * t) * scale;

        if (t === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const hue = this.fastMod360(this.hueBase + c * 72);
      const hue60 = this.fastMod360(hue + 60);
      const hue120 = this.fastMod360(hue + 120);
      const alpha1 = 0.4 + audioIntensity * 0.3;
      const alpha2 = 0.5 + midIntensity * 0.3;

      const gradient = ctx.createLinearGradient(
        negScale,
        negScale,
        scale,
        scale,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 70, alpha1));
      gradient.addColorStop(0.5, this.hsla(hue60, 85, 65, alpha2));
      gradient.addColorStop(1, this.hsla(hue120, 80, 60, alpha1));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5 + audioIntensity * 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderRings(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const ringCount = this.ringCount;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const planetRadius = 60 + bassIntensity * 40;
    const timeRotation = this.time * 0.001;
    const timeThickness = this.time * 0.01;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const invSymbolCount = 1 / 6;

    const planetGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      planetRadius,
    );
    planetGradient.addColorStop(0, this.hsla(this.hueBase, 80, 70, 0.8));
    planetGradient.addColorStop(0.7, this.hsla(this.hueBase, 70, 60, 0.5));
    planetGradient.addColorStop(1, this.hsla(this.hueBase, 60, 50, 0.2));

    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(0, 0, planetRadius, 0, twoPi);
    ctx.fill();

    for (let i = 0; i < ringCount; i++) {
      const radius = planetRadius + 30 + i * 15;
      const rotation = timeRotation * (1 + i * 0.1) + midIntensity * Math.PI;

      const thickness =
        3 + this.fastSin(timeThickness + i) * 2 + audioIntensity * 5;
      const hue = this.fastMod360(this.hueBase + i * 20);

      ctx.save();
      ctx.rotate(rotation);
      ctx.scale(1, 0.3);

      const ringGradient = ctx.createRadialGradient(
        0,
        0,
        radius - thickness,
        0,
        0,
        radius + thickness,
      );
      const ringAlpha = 0.4 + audioIntensity * 0.3;
      ringGradient.addColorStop(0, this.hsla(hue, 80, 60, 0));
      ringGradient.addColorStop(0.5, this.hsla(hue, 90, 70, ringAlpha));
      ringGradient.addColorStop(1, this.hsla(hue, 80, 60, 0));

      ctx.strokeStyle = ringGradient;
      ctx.lineWidth = thickness * 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.stroke();

      if (i % 3 === 0) {
        const symbolCount = 6;
        const angleStep = twoPi * invSymbolCount;
        for (let s = 0; s < symbolCount; s++) {
          const angle = angleStep * s;

          const x = this.fastCos(angle) * radius;
          const y = this.fastSin(angle) * radius;
          const clanIndex = (i + s) % 13;
          const symbolAlpha = 0.12 + audioIntensity * 0.15;
          this.drawClanSymbol(
            ctx,
            x,
            y,
            18 + bassIntensity * 10,
            clanIndex,
            symbolAlpha,
            hue,
          );
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private renderStarfield(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    if (this.stars.length === 0) {
      this.initializeStars();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    // Firefox optimization: Always use stride to reduce star count
    const starStride = detailScale < 0.85 ? 3 : 2;
    const zSpeed =
      (2 + bassIntensity * 15 + trebleIntensity * 10) * this.starSpeed;
    const inv1000 = 1 / 1000;
    const projectionScale = 200;
    const width2 = this.width * 2;
    const height2 = this.height * 2;
    const sizeMultiplier = 2 + audioIntensity * 3;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (!star) continue;
      star.z -= zSpeed;

      if (star.z <= 0) {
        star.z = 1000;

        const rngSeed = (star.x * 1103515245 + star.y * 1664525) & 0x7fffffff;
        const rng1 = rngSeed / 0x7fffffff - 0.5;
        const rng2 =
          ((rngSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
        star.x = rng1 * width2;
        star.y = rng2 * height2;
      }

      if (i % starStride !== 0) continue;

      const invZ = 1 / star.z;
      const x = star.x * invZ * projectionScale + this.centerX;
      const y = star.y * invZ * projectionScale + this.centerY;
      const zRatio = 1 - star.z * inv1000;
      const size = zRatio * star.size * sizeMultiplier;

      if (x < 0 || x > this.width || y < 0 || y > this.height) continue;

      const alpha = zRatio;
      const hue = this.fastMod360(this.hueBase + zRatio * 240);
      const size2 = size * 2;
      const size4 = size * 4;

      // Firefox optimization: NO gradients (was creating 200-500 per frame!)
      ctx.fillStyle = this.hsla(hue, 95, 85, alpha);
      ctx.fillRect(x - size2, y - size2, size4, size4);

      // Firefox optimization: Only draw trails for every 4th star and higher bass
      if ((i & 3) === 0 && bassIntensity > 0.5) {
        const prevZ = star.z + 5 + bassIntensity * 15;
        const invPrevZ = 1 / prevZ;
        const prevX = star.x * invPrevZ * projectionScale + this.centerX;
        const prevY = star.y * invPrevZ * projectionScale + this.centerY;

        ctx.strokeStyle = this.hsla(hue, 80, 70, alpha * 0.3);
        ctx.lineWidth = size * 0.5;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderFluid(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    // Firefox optimization: Larger grid size = fewer operations (was 24, now 36)
    const gridSize = Math.max(36, Math.round(42 / detailScale));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const time = this.time * 0.02;
    const flowFreq = 0.01;
    const distFreq = 0.02;
    const flowBassMultiplier = bassIntensity * 2;
    const length = (15 + audioIntensity * 20) * detailScale;
    const lineWidth = (2 + midIntensity * 3) * detailScale;
    const baseAlpha = 0.3 + audioIntensity * 0.4;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    // Firefox optimization: NO gradients (was creating 500-3600 per frame!)
    // Batch all lines into a single path per hue range for massive performance gain
    const hueRanges = 6; // Group lines by hue into 6 color ranges
    for (let hueRange = 0; hueRange < hueRanges; hueRange++) {
      const rangeHue = this.fastMod360(
        this.hueBase + (hueRange * 360) / hueRanges,
      );
      ctx.strokeStyle = this.hsla(rangeHue, 90, 70, baseAlpha);

      ctx.beginPath();
      for (let y = 0; y < this.height; y += gridSize) {
        for (let x = 0; x < this.width; x += gridSize) {
          const dx = x - this.centerX;
          const dy = y - this.centerY;
          const distSq = dx * dx + dy * dy;
          const dist = this.fastSqrt(distSq);

          const flow1 =
            this.fastSin(x * flowFreq + time) +
            this.fastCos(y * flowFreq + time);
          const flow2 =
            this.fastSin(dist * distFreq - time) * flowBassMultiplier;

          const baseAngle = Math.atan2(dy, dx);
          const angle = baseAngle + flow1 + flow2;

          const endX = x + this.fastCos(angle) * length;
          const endY = y + this.fastSin(angle) * length;

          const hue = this.fastMod360(this.hueBase + dist * 0.3 + flow1 * 60);
          const hueGroup = ((hue / 360) * hueRanges) | 0;

          // Only draw lines that match this hue range
          if (hueGroup === hueRange) {
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
          }
        }
      }
      ctx.stroke(); // Single stroke for all lines in this hue range
    }

    ctx.restore();
  }

  private renderHexGrid(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;

    const minDim = Math.min(this.width, this.height);
    const areaScale = (this.width * this.height) / (1280 * 720);
    const scaleClamp = areaScale < 1 ? 1 : Math.min(areaScale, 2.2);
    const hexSize = (28 + bassIntensity * 16) * Math.sqrt(scaleClamp);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const SQRT3 = 1.7320508075688772;
    const hexHeight = hexSize * SQRT3;
    const hexSize1_5 = hexSize * 1.5;
    const hexSize0_75 = hexSize * 0.75;
    const invHexHeight = 1 / hexHeight;
    const invHexSize1_5 = 1 / hexSize1_5;

    const timeWave = this.time * 0.05;
    const timeRotation = this.time * 0.001 * midIntensity;
    const distFreq = 0.02;
    const pi3 = Math.PI / 3;

    const maxRows = (this.height * 0.9 * invHexHeight + 2) | 0;
    const maxCols = (this.width * 0.9 * invHexSize1_5 + 2) | 0;

    const bassPi = bassIntensity * Math.PI;
    const maxRadius = minDim * 0.7;
    const maxRadiusSq = maxRadius * maxRadius;

    const baseLightness = 38;
    const lightnessRange = 42 + audioIntensity * 18;

    for (let row = -1; row < maxRows; row++) {
      const offsetX = (row & 1) * hexSize0_75;
      const y = row * hexHeight;

      for (let col = -1; col < maxCols; col++) {
        const x = col * hexSize1_5 + offsetX;

        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distSq = dx * dx + dy * dy;

        if (distSq > maxRadiusSq) continue;

        const dist = this.fastSqrt(distSq);

        const wave =
          this.fastSin(dist * distFreq - timeWave + bassPi) * 0.5 + 0.5;
        const hue = this.fastMod360(this.hueBase + dist * 0.28 + wave * 160);
        const lightness = baseLightness + wave * lightnessRange;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = pi3 * i + timeRotation;

          const hx = x + this.fastCos(angle) * hexSize;
          const hy = y + this.fastSin(angle) * hexSize;

          if (i === 0) {
            ctx.moveTo(hx, hy);
          } else {
            ctx.lineTo(hx, hy);
          }
        }
        ctx.closePath();

        ctx.strokeStyle = this.hsla(
          hue,
          78,
          lightness,
          0.45 + audioIntensity * 0.35,
        );
        ctx.lineWidth = 1.5 + audioIntensity * 1.8;
        ctx.stroke();

        if (wave > 0.78) {
          ctx.fillStyle = this.hsla(hue, 88, lightness + 8, (wave - 0.5) * 0.5);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private renderSpirograph(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const layers = 4;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const timeRotation = this.time * 0.005;
    const maxT = Math.PI * 20;
    const stepSize = 0.05;
    const strokeAlpha = 0.4 + audioIntensity * 0.4;
    const lineWidth = 1.5 + audioIntensity * 2.5;

    for (let layer = 0; layer < layers; layer++) {
      const R = 100 + layer * 40;
      const r = 30 + layer * 15 + bassIntensity * 30;
      const d = 20 + layer * 10 + midIntensity * 20;
      const RminusR = R - r;
      const RminusRoverR = RminusR / r;
      const rotation = timeRotation * (layer & 1 ? -1 : 1);

      ctx.beginPath();

      for (let t = 0; t < maxT; t += stepSize) {
        const tPlusRot = t + rotation;
        const innerT = RminusRoverR * t + rotation;

        const x = RminusR * this.fastCos(tPlusRot) + d * this.fastCos(innerT);
        const y = RminusR * this.fastSin(tPlusRot) - d * this.fastSin(innerT);

        if (t === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const hue = this.fastMod360(this.hueBase + layer * 90);
      ctx.strokeStyle = this.hsla(hue, 85, 65, strokeAlpha);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderConstellation(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;

    if (this.constellationStars.length === 0) {
      this.initializeConstellationStars();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const timeWave = this.time * 0.01;
    const bassMove = 0.3 * bassIntensity;
    const midMove = 0.3 * midIntensity;
    const inv200 = 1 / 200;
    const connectionAlpha = 0.3 + audioIntensity * 0.4;
    const lineWidth = 1 + audioIntensity * 2;

    for (const star of this.constellationStars) {
      star.x += this.fastSin(timeWave + star.y) * bassMove;
      star.y += this.fastCos(timeWave + star.x) * midMove;

      if (star.x < 0) star.x = this.width;
      if (star.x > this.width) star.x = 0;
      if (star.y < 0) star.y = this.height;
      if (star.y > this.height) star.y = 0;
    }

    // Firefox optimization: Batch all connections into a single path (NO gradients!)
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const star of this.constellationStars) {
      if (!star) continue;

      for (const connIdx of star.connections) {
        const other = this.constellationStars[connIdx];
        if (!other) continue;

        const dx = other.x - star.x;
        const dy = other.y - star.y;
        const distSq = dx * dx + dy * dy;
        const dist = this.fastSqrt(distSq);

        const distRatio = 1 - dist * inv200;
        if (distRatio <= 0) continue;

        ctx.moveTo(star.x, star.y);
        ctx.lineTo(other.x, other.y);
      }
    }
    // Single stroke for all connections with averaged color
    const avgHue = this.fastMod360(this.hueBase + 30);
    ctx.strokeStyle = this.hsla(avgHue, 82, 72, connectionAlpha);
    ctx.stroke();

    const baseSize = 3 + bassIntensity * 5;
    const sizeRange = 4;
    const starAlpha = 0.85 + audioIntensity * 0.15;

    // Firefox optimization: NO gradients for stars (was creating 20 per frame!)
    for (let i = 0; i < this.constellationStars.length; i++) {
      const star = this.constellationStars[i];
      if (!star) continue;

      const rngSeed = (i * 1103515245 + this.time * 1664525) & 0x7fffffff;
      const sizeRng = rngSeed / 0x7fffffff;
      const size = baseSize + sizeRng * sizeRange;
      const hueRng = ((rngSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const hue = this.fastMod360(this.hueBase + hueRng * 60);
      const size2 = size * 2;
      const size4 = size * 4;

      // Simple fill instead of gradient
      ctx.fillStyle = this.hsla(hue, 98, 88, starAlpha);
      ctx.fillRect(star.x - size2, star.y - size2, size4, size4);

      const twinkleRng =
        ((rngSeed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
      if (twinkleRng > 0.95) {
        const twinkleAlpha = 0.8 + twinkleRng * 0.2;
        ctx.fillStyle = this.hsla(hue, 100, 95, twinkleAlpha);
        ctx.fillRect(star.x - 1, star.y - 1, 2, 2);
      }

      if (i % 3 === 0) {
        const symbolAlpha = 0.2 + audioIntensity * 0.2;
        this.drawClanSymbol(
          ctx,
          star.x,
          star.y,
          25 + bassIntensity * 15,
          i,
          symbolAlpha,
          hue,
        );
      }
    }

    ctx.restore();
  }

  render(dataArray: Uint8Array, bufferLength: number): void {
    const ctx = this.ctx;

    const { audioIntensity, bassIntensity, midIntensity, trebleIntensity } =
      this.analyzeFrequencyBands(dataArray, bufferLength);

    this.time += 1;
    this.hueBase = (this.hueBase + 0.3 + bassIntensity * 1.5) % 360;
    this.updateQualityScale();

    this.updatePatternTransition(audioIntensity);

    const fadeAmount = FlowFieldRenderer.TRAIL_PATTERNS.has(this.currentPattern)
      ? 0.12
      : 0.06;
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAmount + audioIntensity * 0.04})`;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.isTransitioning) {
      const t = this.transitionProgress;

      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      ctx.save();
      ctx.globalAlpha = 1 - eased;
      this.renderPattern(
        this.currentPattern,
        audioIntensity,
        bassIntensity,
        midIntensity,
        trebleIntensity,
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = eased;
      this.renderPattern(
        this.nextPattern,
        audioIntensity,
        bassIntensity,
        midIntensity,
        trebleIntensity,
      );
      ctx.restore();
    } else {
      this.renderPattern(
        this.currentPattern,
        audioIntensity,
        bassIntensity,
        midIntensity,
        trebleIntensity,
      );
    }

    this.renderFpsCounter(ctx);
  }

  private renderFpsCounter(ctx: CanvasRenderingContext2D): void {
    if (!this.showFpsCounter) return;

    const metrics = this.getPerformanceMetrics();

    ctx.save();
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const right = this.width - 12;
    const top = 12;
    const lineHeight = 16;

    const lines = [
      `${metrics.fps} FPS`,
      `${metrics.frameTime} ms`,
      `${metrics.quality}% quality`,
    ];

    const boxWidth = 120;
    const boxHeight = lineHeight * lines.length + 8;

    ctx.fillStyle = "rgba(5, 5, 5, 0.55)";
    ctx.fillRect(right - boxWidth, top - 6, boxWidth, boxHeight);

    ctx.fillStyle = "rgba(244, 178, 102, 0.9)";
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      ctx.fillText(text, right - 6, top + lineHeight * i + 2);
    }

    ctx.restore();
  }

  private renderPattern(
    pattern: Pattern,
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
    trebleIntensity: number,
  ): void {
    switch (pattern) {
      case "fractal":
        this.renderFractal(audioIntensity, bassIntensity, midIntensity);
        break;
      case "rays":
        renderRays(
          this.getPatternContext({
            rayCount: Math.max(6, (this.rayCount * this.qualityScale) | 0),
          }),
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "tunnel":
        this.renderTunnel(audioIntensity, bassIntensity, midIntensity);
        break;
      case "bubbles":
        this.renderBubbles(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "waves":
        this.renderWaves(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "swarm":
        this.renderSwarm(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "mandala":
        this.renderMandala(audioIntensity, bassIntensity, midIntensity);
        break;
      case "dna":
        this.renderDNA(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "galaxy":
        this.renderGalaxy(audioIntensity, bassIntensity, midIntensity);
        break;
      case "matrix":
        this.renderMatrix(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "lightning":
        this.renderLightning(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "fireworks":
        this.renderFireworks(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "lissajous":
        this.renderLissajous(audioIntensity, bassIntensity, midIntensity);
        break;
      case "rings":
        this.renderRings(audioIntensity, bassIntensity, midIntensity);
        break;
      case "starfield":
        this.renderStarfield(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "fluid":
        this.renderFluid(audioIntensity, bassIntensity, midIntensity);
        break;
      case "hexgrid":
        renderHexGrid(
          this.getPatternContext(),
          audioIntensity,
          bassIntensity,
          midIntensity,
        );
        break;
      case "spirograph":
        this.renderSpirograph(audioIntensity, bassIntensity, midIntensity);
        break;
      case "constellation":
        this.renderConstellation(audioIntensity, bassIntensity, midIntensity);
        break;
      case "pentagram":
        this.renderPentagram(audioIntensity, bassIntensity, midIntensity);
        break;
      case "runes":
        this.renderRunes(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "runicSpiral":
        this.renderRunicSpiral(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "sigils":
        this.renderSigils(audioIntensity, bassIntensity, midIntensity);
        break;
      case "ouroboros":
        this.renderOuroboros(audioIntensity, bassIntensity, midIntensity);
        break;
      case "chakras":
        this.renderChakras(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "alchemy":
        this.renderAlchemy(audioIntensity, bassIntensity, midIntensity);
        break;
      case "celestial":
        this.renderCelestial(audioIntensity, bassIntensity, midIntensity);
        break;
      case "portal":
        this.renderPortal(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "dreamcatcher":
        this.renderDreamcatcher(audioIntensity, bassIntensity, midIntensity);
        break;
      case "phoenix":
        this.renderPhoenix(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "serpent":
        this.renderSerpent(audioIntensity, bassIntensity, midIntensity);
        break;
      case "crystalGrid":
        this.renderCrystalGrid(audioIntensity, bassIntensity, midIntensity);
        break;
      case "moonPhases":
        this.renderMoonPhases(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "astrolabe":
        this.renderAstrolabe(audioIntensity, bassIntensity, midIntensity);
        break;
      case "tarot":
        this.renderTarot(audioIntensity, bassIntensity, midIntensity);
        break;
      case "kabbalah":
        this.renderKabbalah(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "merkaba":
        this.renderMerkaba(audioIntensity, bassIntensity, midIntensity);
        break;
      case "flowerOfLife":
        this.renderFlowerOfLife(audioIntensity, bassIntensity, midIntensity);
        break;
      case "sriYantra":
        this.renderSriYantra(audioIntensity, bassIntensity, midIntensity);
        break;
      case "metatron":
        this.renderMetatron(audioIntensity, bassIntensity, midIntensity);
        break;
      case "vesicaPiscis":
        this.renderVesicaPiscis(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "torusField":
        this.renderTorusField(audioIntensity, bassIntensity, midIntensity);
        break;
      case "cosmicEgg":
        this.renderCosmicEgg(audioIntensity, bassIntensity, midIntensity);
        break;
      case "enochian":
        this.renderEnochian(audioIntensity, bassIntensity, midIntensity);
        break;
      case "labyrinth":
        this.renderLabyrinth(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "cosmicWeb":
        this.renderCosmicWeb(audioIntensity, bassIntensity, midIntensity);
        break;
      case "vortexSpiral":
        this.renderVortexSpiral(audioIntensity, bassIntensity, midIntensity);
        break;
      case "sacredSpiral":
        this.renderSacredSpiral(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "elementalCross":
        this.renderElementalCross(audioIntensity, bassIntensity, midIntensity);
        break;
      case "dragonEye":
        this.renderDragonEye(audioIntensity, bassIntensity, midIntensity);
        break;
      case "ancientGlyphs":
        this.renderAncientGlyphs(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "timeWheel":
        this.renderTimeWheel(audioIntensity, bassIntensity, midIntensity);
        break;
      case "astralProjection":
        this.renderAstralProjection(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "ethericField":
        this.renderEthericField(audioIntensity, bassIntensity, midIntensity);
        break;
      case "platonic":
        this.renderPlatonic(audioIntensity, bassIntensity, midIntensity);
        break;
      case "infinityKnot":
        this.renderInfinityKnot(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "cosmicLotus":
        this.renderCosmicLotus(audioIntensity, bassIntensity, midIntensity);
        break;
      case "voidMandala":
        this.renderVoidMandala(audioIntensity, bassIntensity, midIntensity);
        break;
      case "stellarMap":
        this.renderStellarMap(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "wyrdWeb":
        this.renderWyrdWeb(audioIntensity, bassIntensity, midIntensity);
        break;
      case "spiritualGateway":
        this.renderSpiritualGateway(
          audioIntensity,
          bassIntensity,
          midIntensity,
        );
        break;
      case "akashicRecords":
        this.renderAkashicRecords(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "sacredGeometry":
        this.renderSacredGeometry(audioIntensity, bassIntensity, midIntensity);
        break;
      case "shadowRealm":
        this.renderShadowRealm(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "quantumEntanglement":
        this.renderQuantumEntanglement(
          audioIntensity,
          bassIntensity,
          midIntensity,
        );
        break;
      case "necromanticSigil":
        this.renderNecromanticSigil(
          audioIntensity,
          bassIntensity,
          midIntensity,
        );
        break;
      case "dimensionalRift":
        this.renderDimensionalRift(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "chaosVortex":
        this.renderChaosVortex(audioIntensity, bassIntensity, midIntensity);
        break;
      case "etherealMist":
        this.renderEtherealMist(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "bloodMoon":
        this.renderBloodMoon(audioIntensity, bassIntensity, midIntensity);
        break;
      case "darkMatter":
        this.renderDarkMatter(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "soulFragment":
        this.renderSoulFragment(audioIntensity, bassIntensity, midIntensity);
        break;
      case "forbiddenRitual":
        this.renderForbiddenRitual(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "twilightZone":
        this.renderTwilightZone(audioIntensity, bassIntensity, midIntensity);
        break;
      case "spectralEcho":
        this.renderSpectralEcho(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "voidWhisper":
        this.renderVoidWhisper(audioIntensity, bassIntensity, midIntensity);
        break;
      case "demonicGate":
        this.renderDemonicGate(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "cursedRunes":
        this.renderCursedRunes(audioIntensity, bassIntensity, midIntensity);
        break;
      case "shadowDance":
        this.renderShadowDance(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "nightmareFuel":
        this.renderNightmareFuel(audioIntensity, bassIntensity, midIntensity);
        break;
      case "abyssalDepth":
        this.renderAbyssalDepth(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "phantomPulse":
        this.renderPhantomPulse(audioIntensity, bassIntensity, midIntensity);
        break;
      case "infernalFlame":
        this.renderInfernalFlame(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "kaleidoscope":
        renderKaleidoscope(
          this.getPatternContext({
            kaleidoscopeSegments: Math.max(
              3,
              (this.kaleidoscopeSegments * this.qualityScale) | 0,
            ),
            kaleidoscopeRotationSpeed: this.kaleidoscopeRotationSpeed,
            kaleidoscopeParticleDensity: Math.max(
              0.15,
              this.kaleidoscopeParticleDensity * this.qualityScale,
            ),
            kaleidoscopeColorShift: this.kaleidoscopeColorShift,
          }),
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "hydrogenElectronOrbitals":
        this.renderHydrogenElectronOrbitals(
          audioIntensity,
          bassIntensity,
          midIntensity,
          trebleIntensity,
        );
        break;
      case "plasmaStorm":
        this.renderPlasmaStorm(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "bitfieldMatrix":
        this.renderBitfieldMatrix(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "mandelbrotSpiral":
        this.renderMandelbrotSpiral(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "quantumResonance":
        this.renderQuantumResonance(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "morseAurora":
        this.renderMorseAurora(audioIntensity, bassIntensity, midIntensity);
        break;
      case "chromaticAberration":
        this.renderChromaticAberration(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "mengerSponge":
        this.renderMengerSponge(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "perlinNoiseField":
        this.renderPerlinNoiseField(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "superformula":
        this.renderSuperformula(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "voronoi":
        this.renderVoronoi(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "dragonCurve":
        this.renderDragonCurve(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "langtonsAnt":
        this.renderLangtonsAnt(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "celticKnot":
        this.renderCelticKnot(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "germanicKnot":
        this.renderGermanicKnot(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "solarFlare":
        this.renderSolarFlare(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "transcendence":
        this.renderTranscendence(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "treeOfLife":
        this.renderTreeOfLife(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "divineLight":
        this.renderDivineLight(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "gothicThorns":
        this.renderGothicThorns(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "sacredTriangle":
        this.renderSacredTriangle(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "emField":
        this.renderEMField(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "quantumFoam":
        this.renderQuantumFoam(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "prismBloom":
        this.renderPrismBloom(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "auroraWeave":
        this.renderAuroraWeave(audioIntensity, bassIntensity, midIntensity);
        break;
      case "orbitShards":
        this.renderOrbitShards(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "harmonicPetals":
        this.renderHarmonicPetals(audioIntensity, bassIntensity, midIntensity);
        break;
      case "latticeDrift":
        this.renderLatticeDrift(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "nebulaDrift":
        this.renderNebulaDrift(audioIntensity, bassIntensity, midIntensity);
        break;
      case "crystalPulse":
        this.renderCrystalPulse(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "tesseractSpin":
        this.renderTesseractSpin(
          audioIntensity,
          bassIntensity,
          trebleIntensity,
        );
        break;
      case "scanGrid":
        this.renderScanGrid(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "pulseColumns":
        this.renderPulseColumns(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "radarSweep":
        this.renderRadarSweep(audioIntensity, bassIntensity, midIntensity);
        break;
      case "cometTrails":
        this.renderCometTrails(audioIntensity, bassIntensity, trebleIntensity);
        break;
      case "phaseBands":
        this.renderPhaseBands(audioIntensity, bassIntensity, midIntensity);
        break;
      case "valknut":
        this.renderValknut(audioIntensity, bassIntensity, trebleIntensity);
        break;
    }
  }

  private drawClanSymbol(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    clanIndex: number,
    alpha: number,
    hue: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
    ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${alpha * 0.3})`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const clan = clanIndex % 13;

    switch (clan) {
      case 0:
        ctx.beginPath();
        ctx.arc(-size * 0.3, 0, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(size * 0.3, 0, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.stroke();
        break;

      case 1:
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo((i - 1) * size * 0.3, -size * 0.5);
          ctx.lineTo((i - 1) * size * 0.3 + size * 0.1, size * 0.5);
          ctx.stroke();
        }
        break;

      case 2:
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.4);
        ctx.lineTo(size * 0.4, -size * 0.4);
        ctx.lineTo(size * 0.4, size * 0.4);
        ctx.lineTo(-size * 0.4, size * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.4);
        ctx.lineTo(size * 0.4, size * 0.4);
        ctx.moveTo(size * 0.4, -size * 0.4);
        ctx.lineTo(-size * 0.4, size * 0.4);
        ctx.stroke();
        break;

      case 3:
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * size * 0.15, -size * 0.4);
          ctx.lineTo(i * size * 0.15, size * 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-size * 0.4, i * size * 0.15);
          ctx.lineTo(size * 0.4, i * size * 0.15);
          ctx.stroke();
        }
        break;

      case 4:
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = size * 0.3;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 5:
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(-size * 0.4, size * 0.3);
        ctx.lineTo(size * 0.4, size * 0.3);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 6:
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, size * 0.2);
        ctx.lineTo(-size * 0.2, -size * 0.3);
        ctx.lineTo(0, size * 0.1);
        ctx.lineTo(size * 0.2, -size * 0.3);
        ctx.lineTo(size * 0.4, size * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, size * 0.2);
        ctx.lineTo(size * 0.4, size * 0.2);
        ctx.stroke();
        break;

      case 7:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(
            Math.cos(angle) * size * 0.25,
            Math.sin(angle) * size * 0.25,
          );
          ctx.lineTo(
            Math.cos(angle) * size * 0.4,
            Math.sin(angle) * size * 0.4,
          );
          ctx.stroke();
        }
        break;

      case 8:
        ctx.beginPath();
        for (let i = 0; i <= 50; i++) {
          const angle = (i / 50) * Math.PI * 4;
          const r = (i / 50) * size * 0.4;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;

      case 9:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, -Math.PI * 0.7, -Math.PI * 0.3, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(0, size * 0.2);
        ctx.stroke();
        break;

      case 10:
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          const x = (t - 0.5) * size * 0.8;
          const y = Math.sin(t * Math.PI * 3) * size * 0.3;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          size * 0.35,
          Math.sin(Math.PI * 3) * size * 0.3,
          size * 0.08,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        break;

      case 11:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-size * 0.1, -size * 0.1, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(size * 0.1, -size * 0.1, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, size * 0.15, size * 0.15, 0, Math.PI, false);
        ctx.stroke();
        break;

      case 12:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(angle) * size * 0.4,
            Math.sin(angle) * size * 0.4,
          );
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  private getFrequencyBandIntensity(
    dataArray: Uint8Array,
    bufferLength: number,
    startRatio: number,
    endRatio: number,
  ): number {
    const startIndex = (bufferLength * startRatio) | 0;
    const endIndex = (bufferLength * endRatio) | 0;
    const range = endIndex - startIndex;
    if (range <= 0) return 0;
    let sum = 0;
    for (let i = startIndex; i < endIndex; i++) {
      sum += dataArray[i] ?? 0;
    }
    return Math.min(1, (sum * 0.0078125) / range);
  }

  private analyzeFrequencyBands(
    dataArray: Uint8Array,
    bufferLength: number,
  ): {
    audioIntensity: number;
    bassIntensity: number;
    midIntensity: number;
    trebleIntensity: number;
  } {
    const bassEnd = (bufferLength * 0.15) | 0;
    const midEnd = (bufferLength * 0.5) | 0;
    const trebleStart = midEnd;

    let total = 0;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] ?? 0;
      total += value;
      if (i < bassEnd) {
        bassSum += value;
      } else if (i < trebleStart) {
        midSum += value;
      } else {
        trebleSum += value;
      }
    }

    const invByte = 0.0078125;
    const audioIntensity = Math.min(1, (total * invByte) / bufferLength);

    const bassIntensity =
      bassEnd > 0 ? Math.min(1, (bassSum * invByte) / bassEnd) : 0;
    const midRange = trebleStart - bassEnd;
    const midIntensity =
      midRange > 0 ? Math.min(1, (midSum * invByte) / midRange) : 0;
    const trebleRange = bufferLength - trebleStart;
    const trebleIntensity =
      trebleRange > 0 ? Math.min(1, (trebleSum * invByte) / trebleRange) : 0;

    return { audioIntensity, bassIntensity, midIntensity, trebleIntensity };
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 0.16666666666666666) return p + (q - p) * 6 * t;
        if (t < 0.5) return q;
        if (t < 0.6666666666666666)
          return p + (q - p) * (0.6666666666666666 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = l + l - q;
      r = hue2rgb(p, q, h + 0.3333333333333333);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 0.3333333333333333);
    }

    const r255 = (r * 255 + 0.5) | 0;
    const g255 = (g * 255 + 0.5) | 0;
    const b255 = (b * 255 + 0.5) | 0;
    return [
      r255 < 0 ? 0 : r255 > 255 ? 255 : r255,
      g255 < 0 ? 0 : g255 > 255 ? 255 : g255,
      b255 < 0 ? 0 : b255 > 255 ? 255 : b255,
    ];
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.centerX = width * 0.5;
    this.centerY = height * 0.5;
    this.canvas.width = width;
    this.canvas.height = height;

    this.initializeParticles();
    this.initializeBubbles();
    this.initializeStars();
    this.hydrogenElectrons = [];
    this.initializeMatrixColumns();
    this.initializeConstellationStars();
  }

  /**
   * Deep canvas reset to prevent state accumulation and memory pollution.
   * Called every 10 pattern switches (or by Firefox low-FPS safeguard) to clear
   * accumulated transforms, shadows, filters, and other context state that can
   * degrade performance over time.
   */
  private resetCanvasState(
    reason: "pattern-cycle" | "firefox-low-fps" = "pattern-cycle",
  ): void {
    const ctx = this.ctx;

    // Reset all transform matrices
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear all visual effects state
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "transparent";
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // Reset line/stroke properties
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.miterLimit = 10;
    ctx.setLineDash([]);

    // Clear the canvas completely (not just fade)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);

    // Clear cached gradients and paths
    ctx.beginPath();
    ctx.closePath();

    // Clear HSL color cache to prevent unbounded growth
    this.hslCache.clear();
    this.colorStringCache.clear();

    const reasonLabel =
      reason === "firefox-low-fps" ? "Firefox low FPS safeguard" : "every 10 patterns";
    console.log(`[Visual] 🔄 Deep canvas reset performed (${reasonLabel})`);
  }

  private renderPentagram(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const points = 5;
    const outerRadius = 200 + bassIntensity * 150;
    const innerRadius = outerRadius * 0.382;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.002 + midIntensity * 0.1);

    const angleStep = FlowFieldRenderer.TWO_PI / points;
    const halfPi = Math.PI * 0.5;

    for (let layer = 0; layer < 3; layer++) {
      const scale = 1 - layer * 0.3;
      const hue = this.fastMod360(this.hueBase + layer * 40 + this.time * 0.3);

      ctx.strokeStyle = this.hsla(hue, 80, 60, 0.8 - layer * 0.2);
      ctx.fillStyle = this.hsla(hue, 70, 50, 0.1 + audioIntensity * 0.2);
      ctx.lineWidth = 3 - layer;

      ctx.beginPath();
      for (let i = 0; i <= points * 2; i++) {
        const angle = angleStep * i - halfPi;
        const radius = i % 2 === 0 ? outerRadius * scale : innerRadius * scale;
        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    const centerSize = 20 + audioIntensity * 30;
    ctx.fillStyle = this.hsla(this.hueBase, 90, 70, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    ctx.restore();
  }

  private renderRunes(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const runeCount = 8;
    const radius = 250 + bassIntensity * 100;

    const angleStep = FlowFieldRenderer.TWO_PI / runeCount;
    const halfPi = Math.PI * 0.5;
    const size = 40 + trebleIntensity * 30;

    for (let i = 0; i < runeCount; i++) {
      const angle = angleStep * i + this.time * 0.001;
      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      const hue = this.fastMod360(this.hueBase + i * 45);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + halfPi + this.fastSin(this.time * 0.003 + i) * 0.3);

      ctx.strokeStyle = this.hsla(hue, 80, 60, 0.7 + audioIntensity * 0.3);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.6, -size * 0.5);
      ctx.lineTo(size * 0.6, -size * 0.5);
      ctx.moveTo(-size * 0.4, size * 0.3);
      ctx.lineTo(size * 0.4, 0);
      ctx.stroke();

      ctx.restore();
    }

    const runeCount2 = runeCount << 1;
    const angleStep2 = FlowFieldRenderer.TWO_PI / runeCount2;
    const innerRadius = radius * 0.5;
    const size2 = 15 + audioIntensity * 10;
    const halfSize2 = size2 * 0.5;

    for (let i = 0; i < runeCount2; i++) {
      const angle = angleStep2 * i - this.time * 0.002;
      const x = this.centerX + this.fastCos(angle) * innerRadius;
      const y = this.centerY + this.fastSin(angle) * innerRadius;

      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.5 + audioIntensity * 0.3;
      ctx.fillStyle = this.hsla(
        this.fastMod360(this.hueBase + i * 20),
        70,
        60,
        1,
      );
      ctx.fillRect(-halfSize2, -halfSize2, size2, size2);
      ctx.restore();
    }
  }

  private renderRunicSpiral(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    this.renderRunes(audioIntensity, bassIntensity, trebleIntensity);

    const ctx = this.ctx;
    const maxRadius = Math.min(this.width, this.height) * 0.35;
    const turns = 5;
    const points = 96;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 40),
      60,
      60,
      0.45 + audioIntensity * 0.35,
    );
    ctx.lineWidth = 1.5 + trebleIntensity * 1.5;
    ctx.beginPath();

    for (let i = 0; i <= points; i += 1) {
      const t = i / points;
      const angle =
        t * Math.PI * 2 * turns + this.time * 0.0004 + trebleIntensity * 0.3;
      const radius =
        t * maxRadius * (0.75 + 0.25 * this.fastSin(this.time * 0.001 + t * 6));
      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    for (let i = 0; i <= points; i += 8) {
      const t = i / points;
      const angle = t * Math.PI * 2 * turns - this.time * 0.00025;
      const radius = t * maxRadius;
      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      const size = 6 + bassIntensity * 6 + t * 3;

      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.7, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.7, y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSigils(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const sigilCount = 12;

    const angleStep = FlowFieldRenderer.TWO_PI / sigilCount;
    const size = 30 + midIntensity * 25;

    for (let i = 0; i < sigilCount; i++) {
      const angle = angleStep * i + this.time * 0.001;
      const radius =
        200 + this.fastSin(this.time * 0.002 + i) * 50 + bassIntensity * 80;
      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      const hue = this.fastMod360(this.hueBase + i * 30 + this.time * 0.2);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.time * 0.003 + i);

      ctx.strokeStyle = this.hsla(hue, 85, 65, 0.6 + audioIntensity * 0.4);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, FlowFieldRenderer.TWO_PI);
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      const size07 = size * 0.7;
      ctx.moveTo(-size07, -size07);
      ctx.lineTo(size07, size07);
      ctx.moveTo(size07, -size07);
      ctx.lineTo(-size07, size07);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderOuroboros(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const radius = 250 + bassIntensity * 100;
    const segments = 60;
    const thickness = 15 + audioIntensity * 10;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const invSegments = 1 / segments;
    const timeWave1 = this.time * 0.002;
    const timeWave2 = this.time * 0.005;
    const timeWave3 = this.time * 0.3;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const pi8 = Math.PI * 8;
    const pi4 = Math.PI * 4;
    const pi2 = Math.PI * 2;
    const thicknessMid = thickness * (1 + midIntensity * 0.5);
    const halfPi = Math.PI * 0.5;

    for (let i = 0; i < segments; i++) {
      const progress = i * invSegments;
      const angle = progress * twoPi + timeWave1;

      const wave = this.fastSin(progress * pi8 + timeWave2) * 20;
      const r = radius + wave + this.fastSin(progress * pi4) * 30;

      const x = this.fastCos(angle) * r;
      const y = this.fastSin(angle) * r;

      const hue = this.fastMod360(this.hueBase + progress * 120 + timeWave3);
      const alpha = 0.7 + this.fastSin(progress * pi2) * 0.3;

      ctx.fillStyle = this.hsla(hue, 80, 60, alpha);
      ctx.beginPath();
      ctx.arc(x, y, thicknessMid, 0, twoPi);
      ctx.fill();

      if (i % 8 === 0) {
        const scaleSize = thickness * 0.5;
        const halfScaleSize = scaleSize * 0.5;
        ctx.fillStyle = this.hsla(this.fastMod360(hue + 30), 85, 70, 0.5);
        ctx.fillRect(
          x - halfScaleSize,
          y - halfScaleSize,
          scaleSize,
          scaleSize,
        );
      }
    }

    const headAngle = timeWave1;

    const headX = this.fastCos(headAngle) * radius;
    const headY = this.fastSin(headAngle) * radius;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headAngle + halfPi);

    ctx.fillStyle = this.hsla(this.hueBase, 85, 65, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, thickness * 1.5, 0, twoPi);
    ctx.fill();

    const eyeSize = thickness * 0.3;
    const eyeX1 = -thickness * 0.5;
    const eyeX2 = thickness * 0.2;
    const eyeY = -thickness * 0.3;
    ctx.fillStyle = this.hsla(this.fastMod360(this.hueBase + 180), 90, 70, 0.9);
    ctx.fillRect(eyeX1, eyeY, eyeSize, eyeSize);
    ctx.fillRect(eyeX2, eyeY, eyeSize, eyeSize);

    ctx.restore();
    ctx.restore();
  }

  private renderChakras(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const chakraColors = FlowFieldRenderer.CHAKRA_COLORS;

    const chakraCount = chakraColors.length;
    const invChakraCountPlus1 = 1 / (chakraCount + 1);
    const spacing = this.height * invChakraCountPlus1;
    const timePulse = this.time * 0.005;
    const timeRotation = this.time * 0.002;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const baseAlpha = 0.6 + trebleIntensity * 0.4;

    chakraColors.forEach((chakra, i) => {
      const y = spacing * (i + 1);
      const size =
        40 + audioIntensity * 30 + (i === 3 ? bassIntensity * 20 : 0);

      const pulse = this.fastSin(timePulse + i * 0.5) * 10;

      const gradient = ctx.createRadialGradient(
        this.centerX,
        y,
        size * 0.5,
        this.centerX,
        y,
        size + pulse + 40,
      );
      gradient.addColorStop(0, this.hsla(chakra.h, 90, 70, baseAlpha));
      gradient.addColorStop(1, this.hsla(chakra.h, 90, 60, 0));

      ctx.fillStyle = gradient;
      const glowSize = size + 50;
      ctx.fillRect(
        this.centerX - glowSize,
        y - glowSize,
        glowSize * 2,
        glowSize * 2,
      );

      const chakraHue30 = this.fastMod360(chakra.h + 30);
      ctx.fillStyle = this.hsla(chakra.h, 85, 65, 0.8);
      ctx.strokeStyle = this.hsla(chakraHue30, 90, 70, 0.9);
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(this.centerX, y, size + pulse, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      const petalCount = Math.min(i + 3, 8);
      const invPetalCount = 1 / petalCount;
      const petalRadius = size + 15;
      for (let j = 0; j < petalCount; j++) {
        const angle = twoPi * j * invPetalCount + timeRotation;

        const petalX = this.centerX + this.fastCos(angle) * petalRadius;
        const petalY = y + this.fastSin(angle) * petalRadius;

        ctx.save();
        ctx.translate(petalX, petalY);
        ctx.rotate(angle);

        ctx.fillStyle = this.hsla(this.fastMod360(chakra.h + 20), 80, 60, 0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 20, 0, 0, twoPi);
        ctx.fill();
        ctx.restore();
      }
    });

    ctx.strokeStyle = this.hsla(
      this.hueBase,
      70,
      60,
      0.3 + audioIntensity * 0.2,
    );
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(this.centerX, spacing);
    ctx.lineTo(this.centerX, this.height - spacing);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderAlchemy(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const symbols = FlowFieldRenderer.ALCHEMY_SYMBOLS;

    const radius = 180 + bassIntensity * 80;
    const timeRotation = this.time * 0.001;
    const timeSymbolRotation = this.time * 0.003;
    const twoPi = FlowFieldRenderer.TWO_PI;
    symbols.forEach((symbol, i) => {
      const angle = symbol.rotation + timeRotation;

      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      const size = 50 + midIntensity * 30;
      const hue = this.fastMod360(this.hueBase + i * 90);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(timeSymbolRotation + i);

      const strokeAlpha = 0.7 + audioIntensity * 0.3;
      const fillAlpha = 0.2 + audioIntensity * 0.2;
      ctx.strokeStyle = this.hsla(hue, 85, 65, strokeAlpha);
      ctx.fillStyle = this.hsla(hue, 75, 55, fillAlpha);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const sqrt3_2 = 0.8660254037844386;
      const sizeHalf = size * 0.5;
      const sizeSqrt3 = size * sqrt3_2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-sizeSqrt3, sizeHalf);
      ctx.lineTo(sizeSqrt3, sizeHalf);
      ctx.closePath();

      if (i === 1 || i === 3) {
        ctx.save();
        ctx.rotate(Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.stroke();
        ctx.fill();
      }

      if (i === 2 || i === 3) {
        const lineSize = size * 0.6;
        ctx.beginPath();
        ctx.moveTo(-lineSize, 0);
        ctx.lineTo(lineSize, 0);
        ctx.stroke();
      }

      ctx.restore();
    });

    const circleRadius = 60 + audioIntensity * 40;
    ctx.strokeStyle = this.hsla(this.hueBase, 80, 60, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, circleRadius, 0, twoPi);
    ctx.stroke();

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 60),
      85,
      65,
      0.8,
    );
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, twoPi);
    ctx.moveTo(0, 30);
    ctx.lineTo(0, 50);
    ctx.moveTo(-20, 50);
    ctx.lineTo(20, 50);
    ctx.moveTo(-15, -30);
    ctx.lineTo(15, -30);
    ctx.stroke();
    ctx.restore();
  }

  private renderCelestial(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;

    const twoPi = FlowFieldRenderer.TWO_PI;
    const inv12 = 1 / 12;
    const timeRay = this.time * 0.002;

    const baseOrbits = 4;
    const extraOrbits = audioIntensity > 0.7 ? 2 : audioIntensity > 0.4 ? 1 : 0;
    const orbits = baseOrbits + extraOrbits;

    const orbitAlphaBase = 0.18 + audioIntensity * 0.08;

    for (let orbit = 0; orbit < orbits; orbit++) {
      const progress = orbit / orbits;
      const radius = 80 + orbit * 70;
      const planetCount = 3 + (orbit >> 1);
      const invPlanetCount = 1 / planetCount;
      const speed = 0.001 / (orbit + 1);
      const timeSpeed = this.time * speed;

      const orbitHue = this.fastMod360(this.hueBase + orbit * 18);
      const orbitAlpha = orbitAlphaBase * (1 - progress * 0.4);
      ctx.strokeStyle = this.hsla(orbitHue, 60, 45, orbitAlpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, radius, 0, twoPi);
      ctx.stroke();

      for (let i = 0; i < planetCount; i++) {
        const angle = twoPi * i * invPlanetCount + timeSpeed;
        const x = this.centerX + this.fastCos(angle) * radius;
        const y = this.centerY + this.fastSin(angle) * radius;
        const size = 7 + bassIntensity * 6 + orbit * 1.5;
        const hue = this.fastMod360(this.hueBase + orbit * 32 + i * 18);

        const glowAlpha = 0.55 + midIntensity * 0.35;
        ctx.save();
        ctx.shadowBlur = 14 + midIntensity * 18;
        ctx.shadowColor = this.hsla(hue, 90, 70, glowAlpha);
        ctx.fillStyle = this.hsla(hue, 85, 65, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, size * 1.4, 0, twoPi);
        ctx.fill();
        ctx.restore();

        if ((orbit & 1) === 0 && (i & 1) === 0) {
          ctx.strokeStyle = this.hsla(this.fastMod360(hue + 30), 70, 60, 0.35);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, size * 1.9, 0, twoPi);
          ctx.stroke();
        }
      }
    }

    const sunSize = 40 + audioIntensity * 30;
    const sunSize2 = sunSize * 2;
    const sunSizeHalf = sunSize * 0.5;
    const hue60 = this.fastMod360(this.hueBase + 60);
    const hue40 = this.fastMod360(this.hueBase + 40);
    const hue20 = this.fastMod360(this.hueBase + 20);

    const sunGradient = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      sunSizeHalf,
      this.centerX,
      this.centerY,
      sunSize2,
    );
    sunGradient.addColorStop(0, this.hsla(hue60, 100, 80, 1));
    sunGradient.addColorStop(0.5, this.hsla(hue40, 90, 70, 0.6));
    sunGradient.addColorStop(1, this.hsla(hue20, 80, 60, 0));

    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, sunSize2, 0, twoPi);
    ctx.fill();

    const rayAngleStep = twoPi * inv12;
    const rayHue = this.fastMod360(this.hueBase + 50);
    const rayAlpha = 0.45 + bassIntensity * 0.35;
    const rayLength = sunSize + 26 + bassIntensity * 18;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    for (let i = 0; i < 12; i++) {
      const angle = rayAngleStep * i + timeRay;
      ctx.save();
      ctx.rotate(angle);

      ctx.strokeStyle = this.hsla(rayHue, 95, 75, rayAlpha);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sunSize, 0);
      ctx.lineTo(rayLength, 0);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  private renderPortal(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    const maxRingsBase = 16;
    const extraRings = audioIntensity > 0.7 ? 4 : audioIntensity > 0.4 ? 2 : 0;
    const rings = maxRingsBase + extraRings;
    const invRings = 1 / rings;

    const timeRotation = this.time * 0.002;
    const timeWave = this.time * 0.01;
    const timeParticle = this.time * 0.005;
    const timeHue = this.time * 0.5;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const pi6 = Math.PI * 6;

    const baseSegments = 32;
    const extraSegments = (trebleIntensity * 8) | 0;
    const segments = baseSegments + extraSegments;
    const invSegments = 1 / segments;

    const baseParticlesPerRing = 4;
    const invParticles = 1 / baseParticlesPerRing;

    const lineWidth = 3 + trebleIntensity * 2;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    for (let i = 0; i < rings; i++) {
      const progress = i * invRings;
      const radius = 50 + i * (15 + bassIntensity * 10);
      const rotation = timeRotation * (i & 1 ? -1 : 1) + progress * Math.PI;
      const hue = this.fastMod360(this.hueBase + progress * 240 + timeHue);
      const alpha = 0.3 + (1 - progress) * 0.5 + audioIntensity * 0.2;

      ctx.save();
      ctx.rotate(rotation);

      ctx.strokeStyle = this.hsla(hue, 85, 65, alpha);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";

      ctx.beginPath();
      for (let j = 0; j <= segments; j++) {
        const segmentProgress = j * invSegments;
        const angle = segmentProgress * twoPi;

        const r =
          radius * (1 + this.fastSin(segmentProgress * pi6 + timeWave) * 0.1);
        const x = this.fastCos(angle) * r;
        const y = this.fastSin(angle) * r;

        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if ((i & 3) === 0) {
        const particleSize = 2.5 + audioIntensity * 3.5;
        const particleHue = this.fastMod360(hue + 60);
        ctx.fillStyle = this.hsla(particleHue, 90, 70, 0.8);

        for (let j = 0; j < baseParticlesPerRing; j++) {
          const angle = twoPi * j * invParticles + timeParticle;
          const x = this.fastCos(angle) * radius;
          const y = this.fastSin(angle) * radius;

          ctx.beginPath();
          ctx.arc(x, y, particleSize, 0, twoPi);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    ctx.restore();

    const voidSize = 30 + bassIntensity * 20;
    const voidGradient = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      0,
      this.centerX,
      this.centerY,
      voidSize,
    );
    voidGradient.addColorStop(0, `rgba(0, 0, 0, 1)`);
    voidGradient.addColorStop(0.7, `rgba(0, 0, 10, 0.9)`);
    voidGradient.addColorStop(1, this.hsla(this.hueBase, 50, 30, 0.5));

    ctx.fillStyle = voidGradient;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, voidSize, 0, twoPi);
    ctx.fill();
  }

  private renderDreamcatcher(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const outerRadius = 200 + bassIntensity * 80;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeWeb = this.time * 0.001;
    const timeFeather = this.time * 0.003;
    const webLayers = 7;
    const invWebLayers = 1 / webLayers;
    const webAlpha = 0.4 + audioIntensity * 0.3;

    ctx.strokeStyle = this.hsla(this.hueBase, 70, 60, 0.8);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, twoPi);
    ctx.stroke();

    for (let layer = 1; layer <= webLayers; layer++) {
      const layerRadius = outerRadius * (layer * invWebLayers);
      const points = 8 + layer * 2;
      const invPoints = 1 / points;
      const layerHue = this.fastMod360(this.hueBase + layer * 15);

      ctx.strokeStyle = this.hsla(layerHue, 75, 60, webAlpha);
      ctx.lineWidth = 2;

      for (let i = 0; i < points; i++) {
        const angle1 = twoPi * i * invPoints + timeWeb;
        const angle2 = twoPi * (i + 1) * invPoints + timeWeb;

        const x1 = this.fastCos(angle1) * layerRadius;
        const y1 = this.fastSin(angle1) * layerRadius;
        const x2 = this.fastCos(angle2) * layerRadius;
        const y2 = this.fastSin(angle2) * layerRadius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (layer === 1) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }

        const beadSize = 3 + midIntensity * 4;
        const beadHue = this.fastMod360(this.hueBase + i * 20);
        ctx.fillStyle = this.hsla(beadHue, 80, 65, 0.8);
        ctx.beginPath();
        ctx.arc(x1, y1, beadSize, 0, twoPi);
        ctx.fill();
      }
    }

    const featherLength = 80 + bassIntensity * 40;
    const featherHue = this.hueBase;
    for (let i = 0; i < 3; i++) {
      const angle = Math.PI + (i - 1) * 0.4;

      const startX = this.fastCos(angle) * outerRadius;
      const startY = this.fastSin(angle) * outerRadius;
      const sway = this.fastSin(timeFeather + i) * 15;

      const endX = startX + sway;
      const endY = startY + featherLength;

      ctx.strokeStyle = this.hsla(featherHue, 60, 50, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.save();
      ctx.translate(endX, endY);
      ctx.rotate(sway * 0.02);

      const hue = this.fastMod360(this.hueBase + i * 60);
      ctx.fillStyle = this.hsla(hue, 75, 60, 0.6);
      ctx.strokeStyle = this.hsla(hue, 80, 65, 0.8);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-15, 10);
      ctx.lineTo(0, 40);
      ctx.lineTo(15, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  private renderPhoenix(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useGradients = detailScale >= 0.85;
    const wingSpan = (300 + bassIntensity * 100) * detailScale;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const timeWing = this.time * 0.005;
    const timeTail = this.time * 0.01;
    const timeHue = this.time * 0.5;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const halfPi = Math.PI * 0.5;
    const pi04 = -Math.PI * 0.4;
    const pi08 = Math.PI * 0.8;

    for (let side = -1; side <= 1; side += 2) {
      const wingAngle = this.fastSin(timeWing) * 0.3 * side;

      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingAngle);

      const featherCount = Math.max(4, (8 * detailScale) | 0);
      const invFeatherCount = 1 / featherCount;
      for (let i = 0; i < featherCount; i++) {
        const featherProgress = i * invFeatherCount;
        const featherAngle = pi04 + featherProgress * pi08;
        const featherLength = wingSpan * (0.5 + featherProgress * 0.5);
        const hue = ((this.hueBase + i * 15 + timeHue) % 60) | 0;

        ctx.save();
        ctx.rotate(featherAngle);

        const hue20 = hue + 20;
        const hue40 = hue + 40;
        const featherAlpha = 0.8 + audioIntensity * 0.2;
        if (useGradients) {
          const gradient = ctx.createLinearGradient(0, 0, featherLength, 0);
          gradient.addColorStop(0, this.hsla(hue, 90, 60, featherAlpha));
          gradient.addColorStop(0.5, this.hsla(hue20, 95, 65, 0.6));
          gradient.addColorStop(1, this.hsla(hue40, 100, 70, 0.2));
          ctx.strokeStyle = gradient;
        } else {
          ctx.strokeStyle = this.hsla(hue20, 90, 65, 0.6);
        }
        ctx.lineWidth = (15 - i * 1.5 + trebleIntensity * 5) * detailScale;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(featherLength, 0);
        ctx.stroke();

        if (!lowDetail && i % 2 === 0) {
          let rngSeed = (i * 1103515245 + this.time * 1664525) & 0x7fffffff;
          const particleLoops = Math.max(2, (5 * detailScale) | 0);
          for (let j = 0; j < particleLoops; j++) {
            rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
            const rng1 = rngSeed / 0x7fffffff;
            rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
            const rng2 = rngSeed / 0x7fffffff;
            rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
            const rng3 = rngSeed / 0x7fffffff;

            const particleX = featherLength * (0.5 + j * 0.1);
            const particleY = (rng1 - 0.5) * 20;
            const particleSize = 2 + rng2 * 4 + audioIntensity * 3;

            ctx.fillStyle = this.hsla(hue + 30, 100, 70, 0.6 + rng3 * 0.4);
            ctx.beginPath();
            ctx.arc(particleX, particleY, particleSize, 0, twoPi);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      ctx.restore();
    }

    const bodyHue30 = this.fastMod360(this.hueBase + 30);
    const bodyHue10 = this.fastMod360(this.hueBase + 10);
    if (useGradients) {
      const bodyGradient = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
      bodyGradient.addColorStop(0, this.hsla(bodyHue30, 95, 70, 1));
      bodyGradient.addColorStop(0.6, this.hsla(bodyHue10, 90, 60, 0.8));
      bodyGradient.addColorStop(1, this.hsla(this.hueBase, 85, 50, 0.4));
      ctx.fillStyle = bodyGradient;
    } else {
      ctx.fillStyle = this.hsla(bodyHue10, 90, 60, 0.8);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 40 + bassIntensity * 20, 0, twoPi);
    ctx.fill();

    const tailCount = Math.max(6, (12 * detailScale) | 0);
    const tailHalf = tailCount * 0.5;
    for (let i = 0; i < tailCount; i++) {
      const tailAngle =
        halfPi + (i - tailHalf) * 0.1 + this.fastSin(timeTail + i) * 0.2;
      const tailLength = 100 + i * 15 + bassIntensity * 50;
      const hue = (this.hueBase + i * 5) % 60;

      ctx.save();
      ctx.rotate(tailAngle);

      if (useGradients) {
        const tailGradient = ctx.createLinearGradient(0, 0, 0, tailLength);
        tailGradient.addColorStop(0, this.hsla(hue + 20, 95, 65, 0.8));
        tailGradient.addColorStop(1, this.hsla(hue + 40, 100, 70, 0));
        ctx.strokeStyle = tailGradient;
      } else {
        ctx.strokeStyle = this.hsla(hue + 20, 95, 65, 0.6);
      }
      ctx.lineWidth = (10 - i * 0.5) * detailScale;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, tailLength);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  private renderSerpent(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const segments = 40;

    const amplitude = 100 + bassIntensity * 60;
    const invSegments = 1 / segments;
    const timePhase = this.time * 0.01;
    const timeHue = this.time * 0.3;
    const timeTongue = this.time * 0.02;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const phaseMultiplier = 1.5;
    const segmentAlpha = 0.7 + audioIntensity * 0.3;

    for (let i = 0; i < segments; i++) {
      const progress = i * invSegments;
      const phase = timePhase - progress * twoPi;
      const phase15 = phase * phaseMultiplier;

      const x = this.centerX + this.fastCos(phase) * (200 + progress * 100);
      const y = this.centerY + this.fastSin(phase15) * amplitude;

      const nextProgress = (i + 1) * invSegments;
      const nextPhase = timePhase - nextProgress * twoPi;
      const nextPhase15 = nextPhase * phaseMultiplier;
      const nextX =
        this.centerX + this.fastCos(nextPhase) * (200 + nextProgress * 100);
      const nextY = this.centerY + this.fastSin(nextPhase15) * amplitude;

      const size = 20 - progress * 15 + midIntensity * 10;
      const hue = this.fastMod360(this.hueBase + progress * 120 + timeHue);

      ctx.strokeStyle = this.hsla(hue, 80, 60, segmentAlpha);
      ctx.lineWidth = size;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();

      if (i % 3 === 0) {
        ctx.fillStyle = this.hsla(this.fastMod360(hue + 30), 85, 65, 0.6);
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, twoPi);
        ctx.fill();
      }

      if (i === segments - 1) {
        const headSize = size * 1.5;

        ctx.fillStyle = this.hsla(hue, 85, 65, 0.9);
        ctx.beginPath();
        ctx.arc(x, y, headSize, 0, twoPi);
        ctx.fill();

        const eyeOffset = headSize * 0.4;
        const eyeSize = headSize * 0.2;
        const eyeY = y - eyeOffset * 0.5;
        ctx.fillStyle = this.hsla(this.fastMod360(hue + 180), 90, 70, 0.9);
        ctx.beginPath();
        ctx.arc(x - eyeOffset, eyeY, eyeSize, 0, twoPi);
        ctx.arc(x + eyeOffset, eyeY, eyeSize, 0, twoPi);
        ctx.fill();

        const tongueLength = headSize * 2;

        const tongueAngle = this.fastSin(timeTongue) * 0.2;

        ctx.strokeStyle = this.hsla(0, 90, 60, 0.8);
        ctx.lineWidth = 2;

        ctx.save();
        ctx.translate(x, y + headSize);
        ctx.rotate(tongueAngle);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-5, tongueLength);
        ctx.moveTo(0, 0);
        ctx.lineTo(5, tongueLength);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  private renderCrystalGrid(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const gridSize = 4; // Reduced from 6 (36 → 16 crystals, huge perf win)

    const spacing = Math.min(this.width, this.height) / gridSize;
    const timePulse = this.time * 0.005;
    const timeHue = this.time * 0.2;
    const timeRotation = this.time * 0.001;
    const pulseFreq = 0.3;
    const crystalAlpha = 0.6 + bassIntensity * 0.4;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const inv6 = 1 / 6;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = (col + 0.5) * spacing;
        const y = (row + 0.5) * spacing;

        const pulse =
          this.fastSin(timePulse + row * pulseFreq + col * pulseFreq) * 0.5 +
          0.5;
        const size = 20 + pulse * 20 + audioIntensity * 15;
        const hue = this.fastMod360(
          this.hueBase + row * 30 + col * 30 + timeHue,
        );

        // Firefox optimization: Skip gradient glow, use simple fill
        ctx.fillStyle = this.hsla(hue, 85, 65, crystalAlpha * 0.3);
        const size2 = size * 2;
        ctx.fillRect(x - size2, y - size2, size2 * 2, size2 * 2);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(timeRotation + row + col);

        ctx.strokeStyle = this.hsla(hue, 85, 65, 0.8);
        ctx.fillStyle = this.hsla(hue, 75, 60, 0.3 + midIntensity * 0.3);
        ctx.lineWidth = 2;

        // Draw hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = twoPi * i * inv6;
          const cx = this.fastCos(angle) * size;
          const cy = this.fastSin(angle) * size;
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Firefox optimization: Batch internal lines into single path
        ctx.strokeStyle = this.hsla(this.fastMod360(hue + 30), 90, 70, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = twoPi * i * inv6;
          const cx = this.fastCos(angle) * size;
          const cy = this.fastSin(angle) * size;
          ctx.moveTo(0, 0);
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        ctx.restore();

        // Skip connection lines entirely (removes setLineDash overhead and many strokes)
      }
    }
  }

  private renderMoonPhases(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const phases = 8;

    const radius = 200 + bassIntensity * 80;
    const moonSize = 40 + trebleIntensity * 20;
    const invPhases = 1 / phases;
    const timePhase = this.time * 0.001;
    const timeStar = this.time * 0.003;
    const timeStarDist = this.time * 0.01;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const angleStep = twoPi * invPhases;
    const inv3 = 1 / 3;
    const starAngleStep = twoPi * inv3;
    const moonHue = this.fastMod360(this.hueBase + 180);
    const moonGlowAlpha = 0.6 + audioIntensity * 0.4;
    const moonSize2 = moonSize * 2;
    const moonSize4 = moonSize * 4;
    const moonSizeHalf = moonSize * 0.5;

    ctx.strokeStyle = this.hsla(this.hueBase, 60, 50, 0.3);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, radius, 0, twoPi);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < phases; i++) {
      const angle = angleStep * i + timePhase;

      const x = this.centerX + this.fastCos(angle) * radius;
      const y = this.centerY + this.fastSin(angle) * radius;
      const phase = i * invPhases;

      const gradient = ctx.createRadialGradient(
        x,
        y,
        moonSizeHalf,
        x,
        y,
        moonSize2,
      );
      gradient.addColorStop(0, this.hsla(moonHue, 80, 80, moonGlowAlpha));
      gradient.addColorStop(1, this.hsla(moonHue, 70, 70, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(x - moonSize2, y - moonSize2, moonSize4, moonSize4);

      ctx.fillStyle = this.hsla(moonHue, 70, 80, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, moonSize, 0, twoPi);
      ctx.fill();

      if (phase < 0.5) {
        const shadowWidth = moonSize2 * (1 - phase * 2);
        ctx.fillStyle = `rgba(0, 0, 20, 0.8)`;
        ctx.beginPath();
        ctx.arc(x - moonSize + shadowWidth, y, moonSize, 0, twoPi);
        ctx.fill();
      } else {
        const shadowWidth = moonSize2 * ((phase - 0.5) * 2);
        ctx.fillStyle = `rgba(0, 0, 20, 0.8)`;
        ctx.beginPath();
        ctx.arc(x + moonSize - shadowWidth, y, moonSize, 0, twoPi);
        ctx.fill();
      }

      const starSize = 2 + audioIntensity * 3;
      const starHue = this.fastMod360(this.hueBase + 60);
      for (let j = 0; j < 3; j++) {
        const starAngle = starAngleStep * j + timeStar;

        const starDist = moonSize + 20 + this.fastSin(timeStarDist + j) * 5;
        const starX = x + this.fastCos(starAngle) * starDist;
        const starY = y + this.fastSin(starAngle) * starDist;

        ctx.fillStyle = this.hsla(starHue, 90, 70, 0.7);
        ctx.beginPath();
        ctx.arc(starX, starY, starSize, 0, twoPi);
        ctx.fill();
      }
    }

    const centerAlpha = 0.6 + audioIntensity * 0.4;
    ctx.fillStyle = this.hsla(this.hueBase, 80, 60, centerAlpha);
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, 15 + bassIntensity * 10, 0, twoPi);
    ctx.fill();
  }

  private renderAstrolabe(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const outerRadius = 280 + bassIntensity * 60;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.0005);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const pi180 = Math.PI / 180;
    const halfPi = Math.PI * 0.5;
    const inv5 = 1 / 5;
    const timePlanet = this.time * 0.001;
    const pointerAlpha = 0.7 + audioIntensity * 0.3;

    ctx.strokeStyle = this.hsla(this.hueBase, 75, 60, 0.8);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, twoPi);
    ctx.stroke();

    for (let i = 0; i < 360; i += 10) {
      const angle = i * pi180;
      const innerR = i % 30 === 0 ? outerRadius - 20 : outerRadius - 10;
      const lineWidth = i % 30 === 0 ? 3 : 1;

      const cosAngle = this.fastCos(angle);
      const sinAngle = this.fastSin(angle);
      ctx.strokeStyle = this.hsla(
        this.fastMod360(this.hueBase + i),
        70,
        60,
        0.6,
      );
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      ctx.moveTo(cosAngle * innerR, sinAngle * innerR);
      ctx.lineTo(cosAngle * outerRadius, sinAngle * outerRadius);
      ctx.stroke();
    }

    const zodiacRadius = outerRadius * 0.8;
    const signs = 12;
    const invSigns = 1 / signs;
    const symbolAngleStep = twoPi * invSigns;
    const inv3 = 1 / 3;
    const innerSymbolAngleStep = twoPi * inv3;

    for (let i = 0; i < signs; i++) {
      const angle = symbolAngleStep * i;

      const x = this.fastCos(angle) * zodiacRadius;
      const y = this.fastSin(angle) * zodiacRadius;
      const symbolSize = 25 + midIntensity * 15;
      const hue = this.fastMod360(this.hueBase + i * 30);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + halfPi);

      const symbolAlpha = 0.6 + audioIntensity * 0.3;
      ctx.fillStyle = this.hsla(hue, 80, 65, symbolAlpha);
      ctx.strokeStyle = this.hsla(hue, 85, 70, 0.8);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(0, 0, symbolSize, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      const symbolSizeHalf = symbolSize * 0.5;
      ctx.fillStyle = this.hsla(this.fastMod360(hue + 30), 90, 75, 0.8);
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const sAngle = innerSymbolAngleStep * j;
        const sx = this.fastCos(sAngle) * symbolSizeHalf;
        const sy = this.fastSin(sAngle) * symbolSizeHalf;
        if (j === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    for (let ring = 1; ring <= 4; ring++) {
      const ringRadius = outerRadius * (ring * inv5);
      const planetCount = ring + 2;
      const invPlanetCount = 1 / planetCount;
      const planetAngleStep = twoPi * invPlanetCount;

      ctx.strokeStyle = this.hsla(
        this.fastMod360(this.hueBase + ring * 20),
        65,
        55,
        0.3,
      );
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, twoPi);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let p = 0; p < planetCount; p++) {
        const pAngle = planetAngleStep * p - timePlanet * ring;

        const px = this.fastCos(pAngle) * ringRadius;
        const py = this.fastSin(pAngle) * ringRadius;
        const pSize = 6 + audioIntensity * 5;
        const pHue = this.fastMod360(this.hueBase + ring * 40 + p * 20);

        ctx.fillStyle = this.hsla(pHue, 85, 65, 0.8);
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, twoPi);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.rotate(this.time * 0.002);
    const pointerHue = this.fastMod360(this.hueBase + 60);
    ctx.strokeStyle = this.hsla(pointerHue, 90, 70, pointerAlpha);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -outerRadius * 0.7);
    ctx.stroke();

    ctx.fillStyle = this.hsla(pointerHue, 95, 75, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -outerRadius * 0.7);
    ctx.lineTo(-10, -outerRadius * 0.7 + 20);
    ctx.lineTo(10, -outerRadius * 0.7 + 20);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = this.hsla(this.hueBase, 80, 60, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 20 + bassIntensity * 10, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderTarot(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const cardCount = 7;

    const cardWidth = 80 + bassIntensity * 30;
    const cardHeight = cardWidth * 1.5;
    const spacing = (this.width - cardWidth * cardCount) / (cardCount + 1);
    const timeHover = this.time * 0.005;
    const timeRotation = this.time * 0.003;
    const cardWidthHalf = cardWidth * 0.5;
    const cardHeightHalf = cardHeight * 0.5;
    const glowSize = cardWidth * 0.6;
    const glowSize2 = glowSize * 2;
    const glowSizeHalf = glowSize * 0.5;
    const cardGlowAlpha = 0.4 + audioIntensity * 0.3;

    for (let i = 0; i < cardCount; i++) {
      const x = spacing + i * (cardWidth + spacing);
      const y = this.centerY - cardHeightHalf;

      const hover = this.fastSin(timeHover + i * 0.8) * 20;
      const rotation = this.fastSin(timeRotation + i) * 0.1;
      const hue = this.fastMod360(this.hueBase + i * 51);

      ctx.save();
      ctx.translate(x + cardWidthHalf, y + cardHeightHalf + hover);
      ctx.rotate(rotation);

      const gradient = ctx.createRadialGradient(
        0,
        0,
        glowSizeHalf,
        0,
        0,
        glowSize,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 70, cardGlowAlpha));
      gradient.addColorStop(1, this.hsla(hue, 80, 60, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(-glowSize, -glowSize, glowSize2, glowSize2);

      ctx.fillStyle = this.hsla(hue, 30, 20, 0.9);
      ctx.strokeStyle = this.hsla(hue, 80, 65, 0.8);
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.hsla(hue, 80, 50, 0.5);

      ctx.fillRect(-cardWidthHalf, -cardHeightHalf, cardWidth, cardHeight);
      ctx.strokeRect(-cardWidthHalf, -cardHeightHalf, cardWidth, cardHeight);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = this.hsla(this.fastMod360(hue + 30), 85, 70, 0.6);
      ctx.lineWidth = 1;
      ctx.strokeRect(
        -cardWidthHalf + 5,
        -cardHeightHalf + 5,
        cardWidth - 10,
        cardHeight - 10,
      );

      const symbolSize = cardWidth * 0.3 + midIntensity * 10;
      const symbolAlpha = 0.7 + audioIntensity * 0.3;
      const symbolHue60 = this.fastMod360(hue + 60);
      ctx.fillStyle = this.hsla(hue, 90, 70, symbolAlpha);
      ctx.strokeStyle = this.hsla(symbolHue60, 95, 75, 0.9);
      ctx.lineWidth = 2;

      const twoPi = FlowFieldRenderer.TWO_PI;
      const inv8 = 1 / 8;
      const inv5 = 1 / 5;
      const inv4 = 1 / 4;
      const halfPi = Math.PI * 0.5;
      const timeParticle = this.time * 0.01;
      const timeParticleDist = this.time * 0.02;

      const symbolType = i % 4;
      ctx.beginPath();

      switch (symbolType) {
        case 0:
          ctx.arc(0, 0, symbolSize, 0, twoPi);
          for (let r = 0; r < 8; r++) {
            const rAngle = twoPi * r * inv8;

            const cosAngle = this.fastCos(rAngle);
            const sinAngle = this.fastSin(rAngle);
            ctx.moveTo(cosAngle * symbolSize, sinAngle * symbolSize);
            ctx.lineTo(
              cosAngle * symbolSize * 1.4,
              sinAngle * symbolSize * 1.4,
            );
          }
          break;
        case 1:
          ctx.arc(symbolSize * 0.3, 0, symbolSize, 0, twoPi);
          ctx.arc(-symbolSize * 0.3, 0, symbolSize, 0, twoPi);
          break;
        case 2:
          for (let p = 0; p < 5; p++) {
            const pAngle = twoPi * p * inv5 - halfPi;
            const nextAngle = twoPi * (p + 2) * inv5 - halfPi;

            const px = this.fastCos(pAngle) * symbolSize;
            const py = this.fastSin(pAngle) * symbolSize;
            const npx = this.fastCos(nextAngle) * symbolSize;
            const npy = this.fastSin(nextAngle) * symbolSize;
            if (p === 0) ctx.moveTo(px, py);
            ctx.lineTo(npx, npy);
          }
          ctx.closePath();
          break;
        case 3:
          ctx.ellipse(0, 0, symbolSize, symbolSize * 0.6, 0, 0, twoPi);
          ctx.moveTo(symbolSize * 0.3, 0);
          ctx.arc(0, 0, symbolSize * 0.3, 0, twoPi);
          break;
      }

      ctx.fill();
      ctx.stroke();

      const particleDist = cardWidth * 0.6;
      const particleHue = this.fastMod360(hue + 120);
      for (let p = 0; p < 4; p++) {
        const pAngle = twoPi * p * inv4 + timeParticle;

        const pDist = particleDist + this.fastSin(timeParticleDist + p) * 10;
        const px = this.fastCos(pAngle) * pDist;
        const py = this.fastSin(pAngle) * pDist;
        const pSize = 3 + audioIntensity * 4;

        ctx.fillStyle = this.hsla(particleHue, 90, 70, 0.7);
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, twoPi);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderKabbalah(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;

    const sephirot = FlowFieldRenderer.KABBALAH_SEPHIROT;
    const paths = FlowFieldRenderer.KABBALAH_PATHS;

    ctx.save();
    ctx.translate(this.centerX, this.centerY + 50);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const timePath = this.time * 0.003;
    const timeSephira = this.time * 0.004;
    const timeSymbol = this.time * 0.002;
    const inv6 = 1 / 6;
    const symbolAngleStep = twoPi * inv6;

    ctx.lineWidth = 2;
    paths.forEach((path, pathIndex) => {
      const fromIndex = path[0];
      const toIndex = path[1];
      if (fromIndex === undefined || toIndex === undefined) return;

      const from = sephirot[fromIndex];
      const to = sephirot[toIndex];
      if (!from || !to) return;

      const hue = this.fastMod360(this.hueBase + pathIndex * 15);

      const pulse = this.fastSin(timePath + pathIndex * 0.5) * 0.3 + 0.7;

      ctx.strokeStyle = this.hsla(
        hue,
        70,
        60,
        0.3 * pulse + audioIntensity * 0.2,
      );
      ctx.setLineDash([10, 10]);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    sephirot.forEach((sephira, index) => {
      const size =
        30 + (index === 5 ? bassIntensity * 20 : trebleIntensity * 10);
      const hue = this.fastMod360(this.hueBase + sephira.hueOffset);

      const pulse = this.fastSin(timeSephira + index * 0.7) * 0.2 + 0.8;

      const size2 = size * 2;
      const size4 = size * 4;
      const size03 = size * 0.3;
      const glowAlpha = 0.6 * pulse + audioIntensity * 0.3;
      const gradient = ctx.createRadialGradient(
        sephira.x,
        sephira.y,
        size03,
        sephira.x,
        sephira.y,
        size2,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 70, glowAlpha));
      gradient.addColorStop(1, this.hsla(hue, 80, 60, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(sephira.x - size2, sephira.y - size2, size4, size4);

      const hue30 = this.fastMod360(hue + 30);
      ctx.fillStyle = this.hsla(hue, 85, 65, 0.9);
      ctx.strokeStyle = this.hsla(hue30, 90, 70, 0.9);
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(sephira.x, sephira.y, size, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = this.hsla(this.fastMod360(hue + 60), 95, 75, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sephira.x, sephira.y, size * 0.6, 0, twoPi);
      ctx.stroke();

      const symbolCount = 6;
      const sDist = size * 0.4;
      const symbolHue = this.fastMod360(hue + 90);
      for (let s = 0; s < symbolCount; s++) {
        const sAngle = symbolAngleStep * s + timeSymbol;

        const sx = sephira.x + this.fastCos(sAngle) * sDist;
        const sy = sephira.y + this.fastSin(sAngle) * sDist;

        ctx.fillStyle = this.hsla(symbolHue, 90, 70, 0.8);
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, twoPi);
        ctx.fill();
      }
    });

    ctx.restore();
  }

  private renderMerkaba(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const size = 150 + bassIntensity * 80;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.001);

    ctx.save();
    ctx.rotate(this.time * 0.002);

    const upHue = this.hueBase;
    ctx.strokeStyle = `hsla(${upHue}, 85%, 65%, ${0.7 + audioIntensity * 0.3})`;
    ctx.fillStyle = `hsla(${upHue}, 75%, 60%, ${0.2 + midIntensity * 0.2})`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.866, size * 0.5);
    ctx.lineTo(size * 0.866, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const backY = size * 0.2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, backY);
    ctx.moveTo(-size * 0.866, size * 0.5);
    ctx.lineTo(0, backY);
    ctx.moveTo(size * 0.866, size * 0.5);
    ctx.lineTo(0, backY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    ctx.save();
    ctx.rotate(-this.time * 0.002);

    const downHue = (this.hueBase + 180) % 360;
    ctx.strokeStyle = `hsla(${downHue}, 85%, 65%, ${0.7 + audioIntensity * 0.3})`;
    ctx.fillStyle = `hsla(${downHue}, 75%, 60%, ${0.2 + midIntensity * 0.2})`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(-size * 0.866, -size * 0.5);
    ctx.lineTo(size * 0.866, -size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const backY2 = -size * 0.2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(0, backY2);
    ctx.moveTo(-size * 0.866, -size * 0.5);
    ctx.lineTo(0, backY2);
    ctx.moveTo(size * 0.866, -size * 0.5);
    ctx.lineTo(0, backY2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    const sphereGradient = ctx.createRadialGradient(
      0,
      0,
      size * 0.3,
      0,
      0,
      size * 0.7,
    );
    sphereGradient.addColorStop(
      0,
      `hsla(${this.hueBase + 120}, 90%, 70%, ${0.4 + audioIntensity * 0.3})`,
    );
    sphereGradient.addColorStop(1, `hsla(${this.hueBase + 120}, 80%, 60%, 0)`);

    ctx.fillStyle = sphereGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    const particleCount = 12;
    const invParticleCount = 1 / particleCount;
    const timeParticle = this.time * 0.005;
    const orbitRadius = size * 0.6;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const particleAngleStep = twoPi * invParticleCount;

    for (let i = 0; i < particleCount; i++) {
      const angle = particleAngleStep * i + timeParticle;

      const px = this.fastCos(angle) * orbitRadius;
      const py = this.fastSin(angle) * orbitRadius;
      const pSize = 4 + audioIntensity * 5;
      const pHue = this.fastMod360(this.hueBase + i * 30);

      ctx.fillStyle = this.hsla(pHue, 90, 70, 0.8);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, twoPi);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderFlowerOfLife(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const radius = 50 + midIntensity * 20;
    const rings = 2;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.0005);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const timePulse = this.time * 0.005;
    const centerAlpha = 0.7 + audioIntensity * 0.3;
    const ringAlpha = 0.6 + audioIntensity * 0.2;
    const sqrt3 = FlowFieldRenderer.SQRT3;
    const inv6 = 1 / 6;
    const outerAngleStep = twoPi * inv6;

    const centerHue = this.hueBase;
    ctx.strokeStyle = this.hsla(centerHue, 85, 65, centerAlpha);
    ctx.fillStyle = this.hsla(centerHue, 75, 60, 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, twoPi);
    ctx.fill();
    ctx.stroke();

    for (let ring = 1; ring <= rings; ring++) {
      const circlesInRing = ring * 6;
      const invCirclesInRing = 1 / circlesInRing;
      const hue = this.fastMod360(this.hueBase + ring * 40);
      const distance = ring === 1 ? radius : radius * sqrt3 * ring;
      const pulseAlpha = 0.6 + bassIntensity * 0.4;

      for (let i = 0; i < circlesInRing; i++) {
        const angle = twoPi * i * invCirclesInRing;

        const x = this.fastCos(angle) * distance;
        const y = this.fastSin(angle) * distance;

        ctx.strokeStyle = this.hsla(hue, 85, 65, ringAlpha);
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, twoPi);
        ctx.stroke();

        const pulse = this.fastSin(timePulse + i * 0.3) * 3 + 5;
        ctx.fillStyle = this.hsla(
          this.fastMod360(hue + 60),
          90,
          70,
          pulseAlpha,
        );
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, twoPi);
        ctx.fill();
      }
    }

    const outerRadius = radius * 2 * (rings + 1);
    const outerAlpha = 0.4 + audioIntensity * 0.2;
    for (let i = 0; i < 6; i++) {
      const angle = outerAngleStep * i;

      const x = this.fastCos(angle) * outerRadius;
      const y = this.fastSin(angle) * outerRadius;
      const hue = this.fastMod360(this.hueBase + i * 60);

      ctx.strokeStyle = this.hsla(hue, 80, 60, outerAlpha);
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, twoPi);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const hexAlpha = 0.3 + audioIntensity * 0.2;
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 180),
      70,
      60,
      hexAlpha,
    );
    ctx.lineWidth = 1;

    const hexRadius = radius * 2;
    const hexAngleStep = twoPi * inv6;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = hexAngleStep * i;
      const x = this.fastCos(angle) * hexRadius;
      const y = this.fastSin(angle) * hexRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  private renderSriYantra(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const baseSize = 200 + bassIntensity * 60;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const squareSize = baseSize * 1.4;
    ctx.strokeStyle = `hsla(${this.hueBase}, 75%, 60%, 0.7)`;
    ctx.lineWidth = 4;
    ctx.strokeRect(-squareSize / 2, -squareSize / 2, squareSize, squareSize);

    const gateSize = 30;
    const gateOffset = squareSize / 2 - gateSize / 2;

    ctx.fillStyle = `hsla(${this.hueBase + 30}, 80%, 65%, 0.6)`;
    const gates: [number, number][] = [
      [0, -gateOffset],
      [0, gateOffset],
      [-gateOffset, 0],
      [gateOffset, 0],
    ];
    gates.forEach(([x, y]) => {
      ctx.fillRect(x - gateSize / 2, y - gateSize / 2, gateSize, gateSize);
    });

    const twoPi = FlowFieldRenderer.TWO_PI;
    const timePetal = this.time * 0.001;
    const petalAlpha = 0.5 + audioIntensity * 0.3;

    const petalCount = 16;
    const petalRadius = baseSize * 1.2;
    const invPetalCount = 1 / petalCount;
    const petalAngleStep = twoPi * invPetalCount;
    const petalHueStep = 360 * invPetalCount;

    for (let i = 0; i < petalCount; i++) {
      const angle = petalAngleStep * i + timePetal;
      const hue = this.fastMod360(this.hueBase + i * petalHueStep);

      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -petalRadius);

      ctx.fillStyle = this.hsla(hue, 80, 60, petalAlpha);
      ctx.strokeStyle = this.hsla(hue, 85, 65, 0.7);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 40, 0, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    const innerPetalCount = 8;
    const innerPetalRadius = baseSize * 0.9;
    const invInnerPetalCount = 1 / innerPetalCount;
    const innerPetalAngleStep = twoPi * invInnerPetalCount;
    const innerPetalHueStep = 360 * invInnerPetalCount;

    for (let i = 0; i < innerPetalCount; i++) {
      const angle = innerPetalAngleStep * i - timePetal;
      const hue = this.fastMod360(this.hueBase + 180 + i * innerPetalHueStep);

      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -innerPetalRadius);

      ctx.fillStyle = this.hsla(hue, 80, 60, petalAlpha);
      ctx.strokeStyle = this.hsla(hue, 85, 65, 0.7);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 35, 0, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    const triangles = FlowFieldRenderer.SRI_YANTRA_TRIANGLES;

    triangles.forEach((tri) => {
      ctx.save();
      ctx.rotate(tri.rotation + this.time * 0.0003 * (tri.inverted ? -1 : 1));

      const triSize = baseSize * tri.scale;
      const hue = (this.hueBase + tri.hue) % 360;

      ctx.strokeStyle = `hsla(${hue}, 85%, 65%, ${0.6 + midIntensity * 0.3})`;
      ctx.fillStyle = `hsla(${hue}, 75%, 60%, ${0.15 + audioIntensity * 0.15})`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (tri.inverted) {
        ctx.moveTo(0, triSize);
        ctx.lineTo(-triSize * 0.866, -triSize * 0.5);
        ctx.lineTo(triSize * 0.866, -triSize * 0.5);
      } else {
        ctx.moveTo(0, -triSize);
        ctx.lineTo(-triSize * 0.866, triSize * 0.5);
        ctx.lineTo(triSize * 0.866, triSize * 0.5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    const binduSize = 12 + bassIntensity * 10;
    const binduSize2 = binduSize * 2;
    const binduHue60 = this.fastMod360(this.hueBase + 60);
    const binduHue40 = this.fastMod360(this.hueBase + 40);
    const binduHue20 = this.fastMod360(this.hueBase + 20);
    const binduGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, binduSize2);
    binduGradient.addColorStop(0, this.hsla(binduHue60, 100, 80, 1));
    binduGradient.addColorStop(0.5, this.hsla(binduHue40, 90, 70, 0.7));
    binduGradient.addColorStop(1, this.hsla(binduHue20, 80, 60, 0));

    ctx.fillStyle = binduGradient;
    ctx.beginPath();
    ctx.arc(0, 0, binduSize2, 0, twoPi);
    ctx.fill();

    ctx.fillStyle = this.hsla(binduHue60, 100, 90, 1);
    ctx.beginPath();
    ctx.arc(0, 0, binduSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderMetatron(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const radius = 180 + bassIntensity * 60;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.0005);

    const offsets = FlowFieldRenderer.METATRON_OFFSETS;
    const positions = this.metatronPositions;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i]!;
      const idx = i * 2;
      positions[idx] = offset[0] * radius;
      positions[idx + 1] = offset[1] * radius;
    }

    const circleRadius = radius * 0.2;

    const twoPi = FlowFieldRenderer.TWO_PI;
    const timePulse = this.time * 0.004;
    const connectionAlpha = 0.3 + audioIntensity * 0.2;
    const maxDist = radius * 1.2;
    const maxDistSq = maxDist * maxDist;
    const inv6 = 1 / 6;
    const hexAngleStep = twoPi * inv6;

    ctx.strokeStyle = this.hsla(this.hueBase, 70, 60, connectionAlpha);
    ctx.lineWidth = 2;

    ctx.beginPath();
    const circleCount = offsets.length;
    for (let i = 0; i < circleCount; i++) {
      const fromIndex = i * 2;
      const fromX = positions[fromIndex]!;
      const fromY = positions[fromIndex + 1]!;
      for (let j = i + 1; j < circleCount; j++) {
        const toIndex = j * 2;
        const toX = positions[toIndex]!;
        const toY = positions[toIndex + 1]!;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
        }
      }
    }
    ctx.stroke();

    for (let index = 0; index < circleCount; index++) {
      const posIndex = index * 2;
      const posX = positions[posIndex]!;
      const posY = positions[posIndex + 1]!;
      const hue = this.fastMod360(this.hueBase + index * 28);

      const pulse = this.fastSin(timePulse + index * 0.5) * 0.2 + 0.8;
      const size = circleRadius * pulse + (index === 0 ? midIntensity * 15 : 0);

      const size2 = size * 2;
      const size4 = size * 4;
      const size03 = size * 0.3;
      const glowAlpha = 0.5 + audioIntensity * 0.3;
      const gradient = ctx.createRadialGradient(
        posX,
        posY,
        size03,
        posX,
        posY,
        size2,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 70, glowAlpha));
      gradient.addColorStop(1, this.hsla(hue, 80, 60, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(posX - size2, posY - size2, size4, size4);

      const hue30 = this.fastMod360(hue + 30);
      ctx.fillStyle = this.hsla(hue, 85, 65, 0.8);
      ctx.strokeStyle = this.hsla(hue30, 90, 70, 0.9);
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(posX, posY, size, 0, twoPi);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = this.hsla(this.fastMod360(hue + 60), 95, 75, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(posX, posY, size * 0.5, 0, twoPi);
      ctx.stroke();
    }

    const hexPoints = this.metatronHexPoints;
    for (let i = 0; i < 6; i++) {
      const angle = hexAngleStep * i;

      const idx = i * 2;
      hexPoints[idx] = this.fastCos(angle) * radius;
      hexPoints[idx + 1] = this.fastSin(angle) * radius;
    }

    const hexStrokeAlpha = 0.5 + bassIntensity * 0.3;
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 180),
      75,
      65,
      hexStrokeAlpha,
    );
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const idx = i * 2;
      const x = hexPoints[idx]!;
      const y = hexPoints[idx + 1]!;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < 6; i += 2) {
      const idx = i * 2;
      const x = hexPoints[idx]!;
      const y = hexPoints[idx + 1]!;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    for (let i = 1; i < 6; i += 2) {
      const idx = i * 2;
      const x = hexPoints[idx]!;
      const y = hexPoints[idx + 1]!;
      if (i === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  private renderVesicaPiscis(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const radius = 150 + bassIntensity * 60;
    const separation = radius * 1.0;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const separationHalf = separation * 0.5;
    const separationHalfSq = separationHalf * separationHalf;
    const radiusSq = radius * radius;
    const radius03 = radius * 0.3;
    const radius07 = radius * 0.7;
    const circleAlpha = 0.4 + audioIntensity * 0.3;
    const vesicaAlpha = 0.6 + trebleIntensity * 0.4;

    const leftX = -separationHalf;
    const leftHue = this.hueBase;

    const leftGradient = ctx.createRadialGradient(
      leftX,
      0,
      radius03,
      leftX,
      0,
      radius,
    );
    leftGradient.addColorStop(0, this.hsla(leftHue, 90, 70, circleAlpha));
    leftGradient.addColorStop(1, this.hsla(leftHue, 80, 60, 0.1));

    ctx.fillStyle = leftGradient;
    ctx.strokeStyle = this.hsla(leftHue, 85, 65, 0.8);
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(leftX, 0, radius, 0, twoPi);
    ctx.fill();
    ctx.stroke();

    const rightX = separationHalf;
    const rightHue = this.fastMod360(this.hueBase + 120);

    const rightGradient = ctx.createRadialGradient(
      rightX,
      0,
      radius03,
      rightX,
      0,
      radius,
    );
    rightGradient.addColorStop(0, this.hsla(rightHue, 90, 70, circleAlpha));
    rightGradient.addColorStop(1, this.hsla(rightHue, 80, 60, 0.1));

    ctx.fillStyle = rightGradient;
    ctx.strokeStyle = this.hsla(rightHue, 85, 65, 0.8);
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(rightX, 0, radius, 0, twoPi);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(leftX, 0, radius, 0, twoPi);
    ctx.clip();

    const vesicaHue = this.fastMod360(this.hueBase + 240);
    const vesicaGradient = ctx.createRadialGradient(0, 0, 10, 0, 0, radius07);
    vesicaGradient.addColorStop(0, this.hsla(vesicaHue, 95, 75, vesicaAlpha));
    vesicaGradient.addColorStop(1, this.hsla(vesicaHue, 85, 65, 0.2));

    ctx.fillStyle = vesicaGradient;
    ctx.beginPath();
    ctx.arc(rightX, 0, radius, 0, twoPi);
    ctx.fill();

    ctx.restore();

    const intersectionHeightSq = radiusSq - separationHalfSq;
    const intersectionHeight = this.fastSqrt(intersectionHeightSq);

    const vesicaStrokeAlpha = 0.9 + audioIntensity * 0.1;
    ctx.strokeStyle = this.hsla(vesicaHue, 90, 70, vesicaStrokeAlpha);
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(0, -intersectionHeight);
    ctx.arcTo(rightX, 0, 0, intersectionHeight, radius);
    ctx.arcTo(leftX, 0, 0, -intersectionHeight, radius);
    ctx.closePath();
    ctx.stroke();

    const verticalLineY = intersectionHeight * (0.8 + audioIntensity * 0.2);

    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 60),
      80,
      65,
      0.6,
    );
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(0, -verticalLineY);
    ctx.lineTo(0, verticalLineY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-separation, 0);
    ctx.lineTo(separation, 0);
    ctx.stroke();

    ctx.setLineDash([]);

    const topY = -intersectionHeight;
    const bottomY = intersectionHeight;

    for (let i = 0; i < 3; i++) {
      const pointSize = 8 + bassIntensity * 8 + (i === 2 ? 5 : 0);
      const pointHue = this.fastMod360(vesicaHue + i * 60);
      const pointY = i === 0 ? topY : i === 1 ? bottomY : 0;

      ctx.fillStyle = this.hsla(pointHue, 95, 75, 0.9);
      ctx.strokeStyle = this.hsla(this.fastMod360(pointHue + 30), 100, 80, 1);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(0, pointY, pointSize, 0, twoPi);
      ctx.fill();
      ctx.stroke();
    }

    const symbolCount = 6;
    const invSymbolCount = 1 / symbolCount;
    const symbolAngleStep = twoPi * invSymbolCount;
    const symbolDist = radius * 1.5;
    ctx.save();
    ctx.rotate(this.time * 0.002);

    for (let i = 0; i < symbolCount; i++) {
      const angle = symbolAngleStep * i;

      const x = this.fastCos(angle) * symbolDist;
      const y = this.fastSin(angle) * symbolDist;
      const symbolSize = 4 + trebleIntensity * 5;
      const symbolHue = this.fastMod360(this.hueBase + i * 60);

      ctx.fillStyle = this.hsla(symbolHue, 90, 70, 0.7);
      ctx.beginPath();
      ctx.arc(x, y, symbolSize, 0, twoPi);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  private renderTorusField(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const majorRadius = 180 + bassIntensity * 70;
    const minorRadius = 60 + midIntensity * 30;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    ctx.rotate(this.time * 0.001);

    const rings = 30;
    const invRings = 1 / rings;
    const timeRing = this.time * 0.005;
    const timeParticle = this.time * 0.01;
    const timeFlow = this.time * 0.003;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const inv8 = 1 / 8;
    const particleAngleStep = twoPi * inv8;
    const flowLines = 12;
    const invFlowLines = 1 / flowLines;
    const flowAngleStep = twoPi * invFlowLines;
    const inv100 = 1 / 100;
    const minorRadiusHalf = minorRadius * 0.5;

    for (let i = 0; i < rings; i++) {
      const progress = i * invRings;
      const angle = progress * twoPi + timeRing;

      const sinAngle = this.fastSin(angle);
      const cosAngle = this.fastCos(angle);
      const absSinAngle = sinAngle < 0 ? -sinAngle : sinAngle;
      const absCosAngle = cosAngle < 0 ? -cosAngle : cosAngle;

      const ringCenterX = cosAngle * majorRadius;
      const ringCenterY = sinAngle * majorRadius;
      const ringRadius = minorRadius * absSinAngle;

      const hue = this.fastMod360(this.hueBase + progress * 240);
      const alpha = 0.3 + (1 - absCosAngle) * 0.5 + audioIntensity * 0.2;

      const ringRadius15 = ringRadius * 1.5;
      const ringRadius03 = ringRadius * 0.3;
      const ringRadius3 = ringRadius * 3;
      const gradient = ctx.createRadialGradient(
        ringCenterX,
        ringCenterY,
        ringRadius03,
        ringCenterX,
        ringCenterY,
        ringRadius15,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 70, alpha));
      gradient.addColorStop(1, this.hsla(hue, 80, 60, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(
        ringCenterX - ringRadius15,
        ringCenterY - ringRadius15,
        ringRadius3,
        ringRadius3,
      );

      ctx.strokeStyle = this.hsla(hue, 85, 65, alpha);
      ctx.lineWidth = 2 + absSinAngle * 3;

      ctx.beginPath();
      ctx.ellipse(
        ringCenterX,
        ringCenterY,
        ringRadius,
        minorRadiusHalf,
        angle,
        0,
        twoPi,
      );
      ctx.stroke();

      if (i % 3 === 0) {
        const particleHue = this.fastMod360(hue + 60);
        for (let p = 0; p < 8; p++) {
          const pAngle = particleAngleStep * p + timeParticle;

          const pX = ringCenterX + this.fastCos(pAngle) * ringRadius;
          const pY = ringCenterY + this.fastSin(pAngle) * minorRadiusHalf;
          const pSize = 3 + audioIntensity * 4;

          ctx.fillStyle = this.hsla(particleHue, 95, 75, 0.8);
          ctx.beginPath();
          ctx.arc(pX, pY, pSize, 0, twoPi);
          ctx.fill();
        }
      }
    }

    const axisAlpha = 0.4 + audioIntensity * 0.3;
    ctx.strokeStyle = this.hsla(this.hueBase, 70, 60, axisAlpha);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);

    const majorRadius12 = majorRadius * 1.2;
    ctx.beginPath();
    ctx.moveTo(-majorRadius12, 0);
    ctx.lineTo(majorRadius12, 0);
    ctx.stroke();

    ctx.setLineDash([]);

    const flowAlpha = 0.3 + audioIntensity * 0.2;
    for (let i = 0; i < flowLines; i++) {
      const flowAngle = flowAngleStep * i + timeFlow;
      const hue = this.fastMod360(this.hueBase + i * 30);

      ctx.save();
      ctx.rotate(flowAngle);

      ctx.strokeStyle = this.hsla(hue, 80, 65, flowAlpha);
      ctx.lineWidth = 2;

      ctx.beginPath();
      for (let t = 0; t <= 100; t++) {
        const tProgress = t * inv100;
        const tAngle = tProgress * twoPi;

        const cosTAngle = this.fastCos(tAngle);
        const radius = majorRadius + cosTAngle * minorRadius;
        const x = cosTAngle * radius;
        const y = this.fastSin(tAngle) * minorRadiusHalf;

        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    }

    const vortexSize = 30 + bassIntensity * 20;
    const vortexHue120 = this.fastMod360(this.hueBase + 120);
    const vortexHue90 = this.fastMod360(this.hueBase + 90);
    const vortexHue60 = this.fastMod360(this.hueBase + 60);
    const vortexGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, vortexSize);
    vortexGradient.addColorStop(0, this.hsla(vortexHue120, 95, 75, 1));
    vortexGradient.addColorStop(0.6, this.hsla(vortexHue90, 85, 65, 0.6));
    vortexGradient.addColorStop(1, this.hsla(vortexHue60, 75, 55, 0));

    ctx.fillStyle = vortexGradient;
    ctx.beginPath();
    ctx.arc(0, 0, vortexSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderCosmicEgg(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    const eggWidth = 220 + bassIntensity * 80;
    const eggHeight = eggWidth * 1.4;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    ctx.rotate(this.fastSin(this.time * 0.002) * 0.1);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const fieldLayers = 8;
    const invFieldLayers = 1 / fieldLayers;
    const timeHue = this.time * 0.3;
    const timeSpiral = this.time * 0.005;
    const timeStar = this.time * 0.001;
    const timeTwinkle = this.time * 0.01;
    const eggWidthSq = eggWidth * eggWidth;
    const eggHeightSq = eggHeight * eggHeight;
    const invEggWidthSq = 1 / eggWidthSq;
    const invEggHeightSq = 1 / eggHeightSq;
    const eggHeightRatio = eggHeight / eggWidth;
    const eggHeight02 = eggHeight * 0.2;
    const eggHeight06 = eggHeight * 0.6;

    for (let i = 0; i < fieldLayers; i++) {
      const scale = 1 + i * invFieldLayers * 0.5;
      const hue = this.fastMod360(this.hueBase + i * 30 + timeHue);
      const alpha =
        0.1 + (fieldLayers - i) * invFieldLayers * 0.3 + audioIntensity * 0.1;

      ctx.strokeStyle = this.hsla(hue, 80, 65, alpha);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 0, eggWidth * scale, eggHeight * scale, 0, 0, twoPi);
      ctx.stroke();
    }

    const eggHue40 = this.fastMod360(this.hueBase + 40);
    const eggHue80 = this.fastMod360(this.hueBase + 80);
    const eggGradient = ctx.createRadialGradient(
      0,
      -eggHeight02,
      0,
      0,
      0,
      eggHeight06,
    );
    eggGradient.addColorStop(0, this.hsla(this.hueBase, 70, 50, 0.8));
    eggGradient.addColorStop(0.5, this.hsla(eggHue40, 75, 55, 0.6));
    eggGradient.addColorStop(1, this.hsla(eggHue80, 80, 60, 0.4));

    ctx.fillStyle = eggGradient;
    ctx.strokeStyle = this.hsla(this.hueBase, 85, 65, 0.9);
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.ellipse(0, 0, eggWidth, eggHeight, 0, 0, twoPi);
    ctx.fill();
    ctx.stroke();

    const spiralTurns = 5;
    const maxRadius = eggWidth * 0.8;
    const spiralAngleMult = twoPi * spiralTurns;
    const inv360 = 1 / 360;
    const spiralAlpha = 0.6 + audioIntensity * 0.3;

    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 120),
      90,
      70,
      spiralAlpha,
    );
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let t = 0; t <= 360; t++) {
      const progress = t * inv360;
      const angle = progress * spiralAngleMult + timeSpiral;
      const radius = progress * maxRadius;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius * eggHeightRatio;

      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const counterSpiralAlpha = 0.5 + audioIntensity * 0.3;
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 240),
      90,
      70,
      counterSpiralAlpha,
    );
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let t = 0; t <= 360; t++) {
      const progress = t * inv360;
      const angle = -progress * spiralAngleMult - timeSpiral;
      const radius = progress * maxRadius;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius * eggHeightRatio;

      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const starCount = 50;
    const invStarCount = 1 / starCount;
    const starAngleStep = twoPi * invStarCount;
    const inv10 = 1 / 10;
    let rngSeed = (this.time * 1103515245 + 12345) & 0x7fffffff;

    for (let i = 0; i < starCount; i++) {
      const angle = starAngleStep * i + timeStar * (i & 1 ? -1 : 1);
      const radiusProgress = (i % 10) * inv10;
      const radius = radiusProgress * maxRadius;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius * eggHeightRatio;

      const xSq = x * x;
      const ySq = y * y;
      if (xSq * invEggWidthSq + ySq * invEggHeightSq < 0.64) {
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const starSize = 2 + (rngSeed / 0x7fffffff) * 3 + midIntensity * 3;
        const starHue = this.fastMod360(this.hueBase + i * 7);

        const twinkle = this.fastSin(timeTwinkle + i) * 0.3 + 0.7;

        ctx.fillStyle = this.hsla(starHue, 90, 70, twinkle);
        ctx.beginPath();
        ctx.arc(x, y, starSize, 0, twoPi);
        ctx.fill();
      }
    }

    const coreSize = 40 + bassIntensity * 30;
    const coreSize02 = coreSize * 0.2;
    const coreHue60 = this.fastMod360(this.hueBase + 60);
    const coreHue40 = this.fastMod360(this.hueBase + 40);
    const coreHue20 = this.fastMod360(this.hueBase + 20);
    const coreGradient = ctx.createRadialGradient(
      0,
      0,
      coreSize02,
      0,
      0,
      coreSize,
    );
    coreGradient.addColorStop(0, this.hsla(coreHue60, 100, 90, 1));
    coreGradient.addColorStop(0.4, this.hsla(coreHue40, 95, 80, 0.8));
    coreGradient.addColorStop(0.7, this.hsla(coreHue20, 90, 70, 0.5));
    coreGradient.addColorStop(1, this.hsla(this.hueBase, 85, 60, 0));

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreSize, 0, twoPi);
    ctx.fill();

    const rayCount = 12;
    const invRayCount = 1 / rayCount;
    const rayAngleStep = twoPi * invRayCount;
    const timeRay = this.time * 0.003;
    const rayLength = coreSize + 30 + bassIntensity * 20;
    const coreSizeHalf = coreSize * 0.5;
    const rayHue45 = this.fastMod360(this.hueBase + 45);
    const rayHue60 = this.fastMod360(this.hueBase + 60);

    for (let i = 0; i < rayCount; i++) {
      const rayAngle = rayAngleStep * i + timeRay;

      ctx.save();
      ctx.rotate(rayAngle);

      const rayGradient = ctx.createLinearGradient(
        coreSizeHalf,
        0,
        rayLength,
        0,
      );
      rayGradient.addColorStop(0, this.hsla(rayHue45, 95, 75, 0.8));
      rayGradient.addColorStop(1, this.hsla(rayHue60, 90, 70, 0));

      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(coreSizeHalf, 0);
      ctx.lineTo(rayLength, 0);
      ctx.stroke();

      ctx.restore();
    }

    if (audioIntensity > 0.7) {
      const cracks = 8;
      const invCracks = 1 / cracks;
      const crackAngleStep = twoPi * invCracks;
      const timeCrack = this.time * 0.01;
      const crackLength = eggHeight * 0.6;
      const eggHeight02 = eggHeight * 0.2;
      const crackAlpha = audioIntensity - 0.7;
      const crackHue = this.fastMod360(this.hueBase + 180);

      for (let i = 0; i < cracks; i++) {
        const crackAngle = crackAngleStep * i + this.fastSin(timeCrack) * 0.1;

        ctx.save();
        ctx.rotate(crackAngle);

        ctx.strokeStyle = this.hsla(crackHue, 80, 70, crackAlpha);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 10]);

        ctx.beginPath();
        ctx.moveTo(0, eggHeight02);
        const segmentCount = 10;
        const invSegmentCount = 1 / segmentCount;
        const timeCrackSegment = this.time * 0.02;
        for (let s = 0; s <= segmentCount; s++) {
          const sProgress = s * invSegmentCount;
          const y = eggHeight02 + sProgress * crackLength;

          const x = this.fastSin(sProgress * twoPi + timeCrackSegment) * 10;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }
    }

    ctx.restore();
  }
  private renderEnochian(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const gridSize = 4;
    const minDimension = Math.min(this.width, this.height);
    const cellSize = minDimension / (gridSize + 2);
    const cellSize2 = cellSize * 2;
    const cellSizeHalf = cellSize * 0.5;
    const enochianChars = FlowFieldRenderer.ENOCHIAN_CHARS;
    const timeRotation = this.time * 0.003;
    const timeScale = this.time * 0.005;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const crossAlpha = 0.8 + audioIntensity * 0.2;
    const crossHue = this.fastMod360(this.hueBase + 60);

    ctx.strokeStyle = this.hsla(crossHue, 90, 70, crossAlpha);
    ctx.lineWidth = 4 + bassIntensity * 4;
    ctx.beginPath();
    ctx.moveTo(-cellSize2, 0);
    ctx.lineTo(cellSize2, 0);
    ctx.moveTo(0, -cellSize2);
    ctx.lineTo(0, cellSize2);
    ctx.stroke();

    for (let row = -2; row < 2; row++) {
      for (let col = -2; col < 2; col++) {
        const x = col * cellSize + cellSizeHalf;
        const y = row * cellSize + cellSizeHalf;
        const charIndex =
          ((row + 2) * gridSize + (col + 2)) % enochianChars.length;

        const rotation = this.fastSin(timeRotation + row + col) * 0.2;
        const scale =
          1 + this.fastSin(timeScale + row * col) * 0.15 + midIntensity * 0.2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);

        const charHue = this.fastMod360(this.hueBase + charIndex * 15);
        ctx.fillStyle = this.hsla(charHue, 90, 75, 0.9 + audioIntensity * 0.1);
        ctx.font = `${cellSize * 0.5}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(enochianChars[charIndex] ?? "", 0, 0);
        ctx.restore();
      }
    }

    const outerRadius = cellSize * 2.5 + bassIntensity * 20;
    const outerAlpha = 0.7 + audioIntensity * 0.2;
    ctx.strokeStyle = this.hsla(this.hueBase, 90, 70, outerAlpha);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, twoPi);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private renderLabyrinth(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const rings = 7;
    const maxRadius = Math.min(this.width, this.height) * 0.4;
    const invRings = 1 / rings;
    const timeRotation = this.time * 0.001;
    const timeAlpha = this.time * 0.005;
    const twoPi = FlowFieldRenderer.TWO_PI;

    for (let ring = 0; ring < rings; ring++) {
      const radius = maxRadius * (ring + 1) * invRings;
      const segmentCount = 8 + ring * 2;
      const invSegmentCount = 1 / segmentCount;
      const segmentAngleStep = twoPi * invSegmentCount;
      const rotation = timeRotation * (ring & 1 ? -1 : 1);

      ctx.save();
      ctx.rotate(rotation);

      for (let seg = 0; seg < segmentCount; seg++) {
        const angle = segmentAngleStep * seg;
        const nextAngle = segmentAngleStep * (seg + 1);
        const shouldDraw = (seg + ring) % 3 !== 0;

        if (shouldDraw) {
          const hue = this.fastMod360(this.hueBase + ring * 30 + seg * 5);

          const alpha =
            0.6 + this.fastSin(timeAlpha + seg) * 0.2 + trebleIntensity * 0.2;

          ctx.strokeStyle = this.hsla(hue, 85, 65, alpha);
          ctx.lineWidth = 2 + bassIntensity * 2;
          ctx.lineCap = "round";

          ctx.beginPath();
          ctx.arc(0, 0, radius, angle, nextAngle);
          ctx.stroke();

          if (ring < rings - 1 && seg % 2 === 0) {
            const innerRadius = maxRadius * ring * invRings;
            const connectorAngle = (angle + nextAngle) * 0.5;

            const cosConnector = this.fastCos(connectorAngle);
            const sinConnector = this.fastSin(connectorAngle);
            const x1 = cosConnector * innerRadius;
            const y1 = sinConnector * innerRadius;
            const x2 = cosConnector * radius;
            const y2 = sinConnector * radius;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    const centerGlow = 20 + bassIntensity * 15;
    const centerHue = this.fastMod360(this.hueBase + 180);
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerGlow);
    centerGradient.addColorStop(0, this.hsla(centerHue, 100, 80, 1));
    centerGradient.addColorStop(1, this.hsla(centerHue, 100, 80, 0));
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerGlow, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderCosmicWeb(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const nodeCount = 12;
    const nodes: { x: number; y: number }[] = [];
    const radius = Math.min(this.width, this.height) * 0.35;
    const invNodeCount = 1 / nodeCount;
    const timeNode = this.time * 0.002;
    const pi4 = Math.PI * 4;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxDistance = radius * 0.8;
    const maxDistanceSq = maxDistance * maxDistance;

    for (let i = 0; i < nodeCount; i++) {
      const spiralProgress = i * invNodeCount;
      const angle = spiralProgress * pi4 + timeNode;
      const r = radius * (0.3 + spiralProgress * 0.7);

      nodes.push({ x: this.fastCos(angle) * r, y: this.fastSin(angle) * r });
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeI = nodes[i];
        const nodeJ = nodes[j];
        if (!nodeI || !nodeJ) continue;

        const dx = nodeJ.x - nodeI.x;
        const dy = nodeJ.y - nodeI.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistanceSq) {
          const distance = this.fastSqrt(distSq);
          const invMaxDistance = 1 / maxDistance;
          const distRatio = 1 - distance * invMaxDistance;
          const alpha = distRatio * 0.4 + midIntensity * 0.2;
          const hue = this.fastMod360(this.hueBase + i * 15 + j * 10);

          ctx.strokeStyle = this.hsla(hue, 80, 65, alpha);
          ctx.lineWidth = 1 + distRatio * 2;

          const pulsePos = (this.time * 0.005 + i * 0.1) % 1;
          const pulseX = nodeI.x + (nodeJ.x - nodeI.x) * pulsePos;
          const pulseY = nodeI.y + (nodeJ.y - nodeI.y) * pulsePos;

          ctx.beginPath();
          ctx.moveTo(nodeI.x, nodeI.y);
          ctx.lineTo(nodeJ.x, nodeJ.y);
          ctx.stroke();

          const pulseHue = this.fastMod360(hue + 60);
          ctx.fillStyle = this.hsla(
            pulseHue,
            90,
            75,
            0.8 + audioIntensity * 0.2,
          );
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 3 + bassIntensity * 2, 0, twoPi);
          ctx.fill();
        }
      }
    }

    const timeNodeSize = this.time * 0.003;
    nodes.forEach((node, i) => {
      const nodeSize =
        6 + this.fastSin(timeNodeSize + i) * 3 + bassIntensity * 4;
      const hue = this.fastMod360(this.hueBase + i * 20);
      const nodeSize2 = nodeSize * 2;

      const gradient = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        nodeSize2,
      );
      gradient.addColorStop(0, this.hsla(hue, 90, 75, 1));
      gradient.addColorStop(0.5, this.hsla(hue, 85, 70, 0.6));
      gradient.addColorStop(1, this.hsla(hue, 80, 65, 0));

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, twoPi);
      ctx.fill();
    });

    ctx.restore();
  }

  private renderVortexSpiral(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const arms = 5;
    const maxRadius = Math.min(this.width, this.height) * 0.45;
    const turns = 4;
    const invArms = 1 / arms;
    const armAngleStep = FlowFieldRenderer.TWO_PI * invArms;
    const hueStep = 360 * invArms;
    const timeSpiral = this.time * 0.003;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const angleMult = twoPi * turns;
    const inv100 = 1 / 100;

    for (let arm = 0; arm < arms; arm++) {
      const armOffset = armAngleStep * arm;
      const armHue = this.fastMod360(this.hueBase + arm * hueStep);

      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const progress = i * inv100;
        const angle = armOffset + progress * angleMult + timeSpiral;
        const radius = progress * maxRadius * (0.1 + progress * 0.9);

        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const gradient = ctx.createLinearGradient(0, 0, maxRadius, 0);
      gradient.addColorStop(0, this.hsla(armHue, 90, 70, 0.2));
      const midAlpha = 0.6 + midIntensity * 0.3;
      gradient.addColorStop(0.5, this.hsla(armHue, 85, 65, midAlpha));
      gradient.addColorStop(1, this.hsla(armHue, 80, 60, 0.9));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 + bassIntensity * 4;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    const eyeSize = 30 + bassIntensity * 20;
    const eyeHue180 = this.fastMod360(this.hueBase + 180);
    const eyeHue120 = this.fastMod360(this.hueBase + 120);
    const eyeGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeSize);
    eyeGradient.addColorStop(0, this.hsla(eyeHue180, 100, 90, 1));
    eyeGradient.addColorStop(0.6, this.hsla(eyeHue120, 90, 70, 0.7));
    eyeGradient.addColorStop(1, this.hsla(this.hueBase, 80, 60, 0));

    ctx.fillStyle = eyeGradient;
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderSacredSpiral(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const phi = 1.618033988749;
    const maxRadius = Math.min(this.width, this.height) * 0.4;
    const turns = 3;
    const spiralCount = 3;
    const invSpiralCount = 1 / spiralCount;
    const offsetStep = FlowFieldRenderer.TWO_PI * invSpiralCount;
    const hueStep = 120;
    const timeSpiral = this.time * 0.002;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const angleMult = twoPi * turns;
    const inv200 = 1 / 200;
    const invPhi = 1 / phi;
    const phiMinus2 = Math.pow(phi, -2);
    const spiralAlpha = 0.6 + trebleIntensity * 0.3;

    for (let spiralIndex = 0; spiralIndex < spiralCount; spiralIndex++) {
      const offset = offsetStep * spiralIndex;
      const hue = this.fastMod360(this.hueBase + spiralIndex * hueStep);
      const timeDir = timeSpiral * (spiralIndex & 1 ? -1 : 1);

      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const progress = i * inv200;
        const angle = offset + progress * angleMult + timeDir;

        const phiPower = phiMinus2 * Math.pow(phi, progress * 3);
        const radius = maxRadius * phiPower * invPhi;

        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = this.hsla(hue, 85, 65, spiralAlpha);
      ctx.lineWidth = 2 + bassIntensity * 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderElementalCross(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const armLength = Math.min(this.width, this.height) * 0.35;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeSymbol = this.time * 0.005;
    const armLength085 = armLength * 0.85;
    const armLength015 = armLength * 0.15;
    const elements = FlowFieldRenderer.ELEMENTAL_CROSS_ELEMENTS;

    elements.forEach((element, index) => {
      ctx.save();
      ctx.rotate(element.angle);

      const elementAlpha = 0.8 + audioIntensity * 0.2;
      const gradient = ctx.createLinearGradient(0, 0, armLength, 0);
      gradient.addColorStop(0, this.hsla(element.hue, 90, 70, elementAlpha));
      gradient.addColorStop(1, this.hsla(element.hue, 90, 70, 0));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 8 + bassIntensity * 6;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(armLength, 0);
      ctx.stroke();

      ctx.translate(armLength085, 0);

      const symbolScale =
        1 + this.fastSin(timeSymbol + index) * 0.2 + midIntensity * 0.3;
      ctx.scale(symbolScale, symbolScale);

      const symbolAlpha = 0.9 + audioIntensity * 0.1;
      ctx.fillStyle = this.hsla(element.hue, 95, 75, symbolAlpha);
      ctx.font = `${armLength015}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(element.symbol, 0, 0);

      ctx.restore();
    });

    const centerSize = 40 + bassIntensity * 20;
    const centerHue60 = this.fastMod360(this.hueBase + 60);
    const centerHue120 = this.fastMod360(this.hueBase + 120);
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerSize);
    centerGradient.addColorStop(0, this.hsla(this.hueBase, 95, 80, 1));
    centerGradient.addColorStop(0.7, this.hsla(centerHue60, 90, 70, 0.7));
    centerGradient.addColorStop(1, this.hsla(centerHue120, 85, 60, 0));

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderDragonEye(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const eyeWidth = Math.min(this.width, this.height) * 0.4;
    const eyeHeight = eyeWidth * 0.6;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const eyeHue30 = this.fastMod360(this.hueBase + 30);

    ctx.fillStyle = this.hsla(eyeHue30, 40, 90, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, twoPi);
    ctx.fill();

    const irisRadius = eyeHeight * 0.7;
    const irisHue40 = this.fastMod360(this.hueBase + 40);
    const irisHue20 = this.fastMod360(this.hueBase + 20);
    const irisGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, irisRadius);
    irisGradient.addColorStop(0, this.hsla(irisHue40, 80, 60, 1));
    irisGradient.addColorStop(0.6, this.hsla(irisHue20, 85, 55, 1));
    irisGradient.addColorStop(1, this.hsla(this.hueBase, 70, 40, 1));

    ctx.fillStyle = irisGradient;
    ctx.beginPath();
    ctx.arc(0, 0, irisRadius, 0, twoPi);
    ctx.fill();

    const scaleCount = 12;
    const invScaleCount = 1 / scaleCount;
    const scaleAngleStep = twoPi * invScaleCount;
    const timeScale = this.time * 0.001;
    const scaleRadius = irisRadius * 0.4;
    const scaleAlpha = 0.3 + midIntensity * 0.2;

    for (let i = 0; i < scaleCount; i++) {
      const angle = scaleAngleStep * i + timeScale;
      const scaleHue = this.fastMod360(this.hueBase + i * 10);

      ctx.save();
      ctx.rotate(angle);

      ctx.strokeStyle = this.hsla(scaleHue, 90, 65, scaleAlpha);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(scaleRadius, 0);
      ctx.stroke();

      ctx.restore();
    }

    const pupilWidth = 8 + bassIntensity * 6;
    const pupilHeight = irisRadius * 1.5 * (0.7 + audioIntensity * 0.3);

    ctx.fillStyle = this.hsla(0, 0, 5, 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, pupilWidth, pupilHeight, 0, 0, twoPi);
    ctx.fill();

    ctx.strokeStyle = this.hsla(this.hueBase, 85, 50, 0.9);
    ctx.lineWidth = 4 + bassIntensity * 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, twoPi);
    ctx.stroke();

    ctx.restore();
  }

  private renderAncientGlyphs(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const glyphs = FlowFieldRenderer.ANCIENT_GLYPHS;
    const radius = Math.min(this.width, this.height) * 0.35;
    const glyphCount = 16;
    const invGlyphCount = 1 / glyphCount;
    const glyphAngleStep = FlowFieldRenderer.TWO_PI * invGlyphCount;
    const timeGlyph = this.time * 0.002;
    const timeRotation = this.time * 0.003;
    const timeScale = this.time * 0.005;
    const radius015 = radius * 0.15;
    const radius02 = radius * 0.2;
    const glyphAlpha = 0.9 + audioIntensity * 0.1;
    const glyphsLength = glyphs.length;

    for (let i = 0; i < glyphCount; i++) {
      const angle = glyphAngleStep * i + timeGlyph;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const glyphIndex = i % glyphsLength;
      const rotation = timeRotation * (i & 1 ? -1 : 1);

      const scale =
        1 + this.fastSin(timeScale + i) * 0.2 + trebleIntensity * 0.3;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      const hue = this.fastMod360(this.hueBase + i * 20);
      ctx.fillStyle = this.hsla(hue, 95, 80, glyphAlpha);
      ctx.font = `${radius015}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyphs[glyphIndex] ?? "", 0, 0);

      ctx.restore();
    }

    ctx.fillStyle = this.hsla(this.hueBase, 100, 85, glyphAlpha);
    ctx.font = `${radius02}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☯", 0, 0);

    ctx.restore();
  }

  private renderTimeWheel(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const outerRadius = Math.min(this.width, this.height) * 0.4;
    const rings = 5;
    const invRings = 1 / rings;
    const timeRotation = this.time * 0.001;
    const timeAlpha = this.time * 0.005;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const halfPi = Math.PI * 0.5;
    const outerRadius085 = outerRadius * 0.85;
    const outerRadius08 = outerRadius * 0.08;
    const markerAlpha = 0.9 + audioIntensity * 0.1;

    for (let ring = 0; ring < rings; ring++) {
      const ringRatio = (ring + 1) * invRings;
      const radius = outerRadius * ringRatio;
      const segments = 12 * (ring + 1);
      const invSegments = 1 / segments;
      const segmentAngleStep = twoPi * invSegments;
      const rotation = timeRotation * (ring & 1 ? -1 : 1) * (ring + 1);
      const hueStep = 360 * invSegments;

      ctx.save();
      ctx.rotate(rotation);

      for (let seg = 0; seg < segments; seg++) {
        const angle = segmentAngleStep * seg;
        const nextAngle = segmentAngleStep * (seg + 1);

        const hue = this.fastMod360(this.hueBase + seg * hueStep + ring * 20);

        const alpha =
          0.4 + this.fastSin(timeAlpha + seg + ring) * 0.2 + midIntensity * 0.2;

        ctx.fillStyle = this.hsla(hue, 80, 60, alpha * 0.3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, nextAngle);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = this.hsla(hue, 85, 70, alpha);
        ctx.lineWidth = 1 + (ring === rings - 1 ? bassIntensity * 2 : 0);
        ctx.stroke();
      }

      ctx.restore();
    }

    const markers = 12;
    const invMarkers = 1 / markers;
    const markerAngleStep = twoPi * invMarkers;
    const markerHueStep = 30;

    for (let i = 0; i < markers; i++) {
      const angle = markerAngleStep * i - halfPi;

      const x = this.fastCos(angle) * outerRadius085;
      const y = this.fastSin(angle) * outerRadius085;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + halfPi);

      const markerHue = this.fastMod360(this.hueBase + i * markerHueStep);
      ctx.fillStyle = this.hsla(markerHue, 90, 75, markerAlpha);
      ctx.font = `${outerRadius08}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((i + 1).toString(), 0, 0);

      ctx.restore();
    }

    const centerGlow = 15 + bassIntensity * 10;
    const centerHue = this.fastMod360(this.hueBase + 180);
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerGlow);
    centerGradient.addColorStop(0, this.hsla(centerHue, 100, 90, 1));
    centerGradient.addColorStop(1, this.hsla(centerHue, 100, 90, 0));

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerGlow, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderAstralProjection(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const bodySize = Math.min(this.width, this.height) * 0.15;
    const timeAstral = this.time * 0.002;
    const timeAlpha = this.time * 0.003;
    const timeControl = this.time * 0.005;
    const timeGlow = this.time * 0.004;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const bodySize06 = bodySize * 0.6;
    const bodySize08 = bodySize * 0.8;
    const bodySize04 = bodySize * 0.4;
    const astralGlow = bodySize * 2;
    const astralHue240 = this.fastMod360(this.hueBase + 240);
    const astralHue200 = this.fastMod360(this.hueBase + 200);
    const astralHue160 = this.fastMod360(this.hueBase + 160);
    const astralHue180 = this.fastMod360(this.hueBase + 180);

    const astralOffset = this.fastSin(timeAstral) * 50 + bassIntensity * 30;

    ctx.save();
    ctx.translate(0, astralOffset);

    ctx.globalAlpha = 0.4 + this.fastSin(timeAlpha) * 0.1;

    ctx.fillStyle = this.hsla(this.hueBase, 60, 50, 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodySize06, bodySize, 0, 0, twoPi);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -bodySize08, bodySize04, 0, twoPi);
    ctx.fill();

    ctx.restore();

    const connectionAlpha = 0.5 + trebleIntensity * 0.3;
    ctx.strokeStyle = this.hsla(astralHue180, 80, 75, connectionAlpha);
    ctx.lineWidth = 2 + bassIntensity * 2;
    ctx.setLineDash([5, 10]);

    ctx.beginPath();
    ctx.moveTo(0, astralOffset);

    const controlPoints = 5;
    const invControlPoints = 1 / controlPoints;
    for (let i = 0; i <= controlPoints; i++) {
      const progress = i * invControlPoints;

      const x = this.fastSin(progress * twoPi + timeControl) * 20;
      const y = astralOffset - progress * astralOffset;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();

    ctx.globalAlpha = 0.7 + this.fastSin(timeGlow) * 0.2 + audioIntensity * 0.2;

    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, astralGlow);
    glowGradient.addColorStop(0, this.hsla(astralHue240, 90, 75, 0.6));
    glowGradient.addColorStop(0.5, this.hsla(astralHue200, 85, 70, 0.3));
    glowGradient.addColorStop(1, this.hsla(astralHue160, 80, 65, 0));

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, astralGlow, 0, twoPi);
    ctx.fill();

    ctx.fillStyle = this.hsla(astralHue240, 90, 80, 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodySize06, bodySize, 0, 0, twoPi);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -bodySize08, bodySize04, 0, twoPi);
    ctx.fill();

    ctx.restore();

    ctx.restore();
  }

  private renderEthericField(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const layers = 8;
    const maxRadius = Math.min(this.width, this.height) * 0.45;
    const invLayers = 1 / layers;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const inv100 = 1 / 100;
    const timeWave = this.time * 0.003;
    const timePulse = this.time * 0.002;
    const hueStep = 45;

    for (let layer = 0; layer < layers; layer++) {
      const radius = maxRadius * (layer + 1) * invLayers;
      const hue = this.fastMod360(this.hueBase + layer * hueStep);
      const waveCount = 8 + layer * 2;
      const waveAmplitude = 10 + bassIntensity * 8;
      const radius08 = radius * 0.8;
      const radius12 = radius * 1.2;
      const layerTimeWave = timeWave * layer;
      const layerTimePulse = timePulse + layer;

      ctx.beginPath();

      for (let i = 0; i <= 100; i++) {
        const progress = i * inv100;
        const angle = progress * twoPi;

        const wave =
          this.fastSin(angle * waveCount + layerTimeWave) * waveAmplitude;
        const r = radius + wave + this.fastSin(layerTimePulse) * 5;

        const x = this.fastCos(angle) * r;
        const y = this.fastSin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const gradientAlpha = 0.15 + midIntensity * 0.1;
      const gradient = ctx.createRadialGradient(0, 0, radius08, 0, 0, radius12);
      gradient.addColorStop(0, this.hsla(hue, 80, 60, 0));
      gradient.addColorStop(0.5, this.hsla(hue, 85, 65, gradientAlpha));
      gradient.addColorStop(1, this.hsla(hue, 90, 70, 0));

      ctx.fillStyle = gradient;
      ctx.fill();

      const strokeAlpha = 0.4 + audioIntensity * 0.2;
      ctx.strokeStyle = this.hsla(hue, 90, 70, strokeAlpha);
      ctx.lineWidth = 1 + (layer === layers - 1 ? bassIntensity * 2 : 0);
      ctx.stroke();
    }

    const coreSize = 25 + bassIntensity * 15;
    const coreHue60 = this.fastMod360(this.hueBase + 60);
    const coreHue120 = this.fastMod360(this.hueBase + 120);
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize);
    coreGradient.addColorStop(0, this.hsla(this.hueBase, 100, 90, 1));
    coreGradient.addColorStop(0.5, this.hsla(coreHue60, 90, 75, 0.8));
    coreGradient.addColorStop(1, this.hsla(coreHue120, 80, 60, 0));

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderPlatonic(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const solids = FlowFieldRenderer.PLATONIC_SOLIDS;
    const arrangementRadius = Math.min(this.width, this.height) * 0.28;
    const solidsLength = solids.length;
    const invSolidsLength = 1 / solidsLength;
    const angleStep = FlowFieldRenderer.TWO_PI * invSolidsLength;
    const halfPi = Math.PI * 0.5;
    const timeRotation = this.time * 0.002;
    const timeSize = this.time * 0.005;
    const twoPi = FlowFieldRenderer.TWO_PI;

    solids.forEach((solid, index) => {
      const angle = angleStep * index - halfPi;

      const x = this.fastCos(angle) * arrangementRadius;
      const y = this.fastSin(angle) * arrangementRadius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(timeRotation * (index & 1 ? -1 : 1));

      const size =
        60 + this.fastSin(timeSize + index) * 10 + bassIntensity * 15;
      const hue = this.fastMod360(this.hueBase + solid.hue);
      const invSides = 1 / solid.sides;
      const polyAngleStep = twoPi * invSides;

      const strokeAlpha = 0.8 + midIntensity * 0.2;
      const fillAlpha = 0.2 + audioIntensity * 0.1;
      ctx.strokeStyle = this.hsla(hue, 85, 65, strokeAlpha);
      ctx.fillStyle = this.hsla(hue, 80, 60, fillAlpha);
      ctx.lineWidth = 2 + bassIntensity * 2;

      ctx.beginPath();
      for (let i = 0; i <= solid.sides; i++) {
        const polyAngle = polyAngleStep * i;

        const px = this.fastCos(polyAngle) * size;
        const py = this.fastSin(polyAngle) * size;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    const centerSize = 20 + bassIntensity * 10;
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerSize);
    centerGradient.addColorStop(0, this.hsla(this.hueBase, 100, 90, 1));
    centerGradient.addColorStop(1, this.hsla(this.hueBase, 100, 90, 0));

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderInfinityKnot(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const size = Math.min(this.width, this.height) * 0.35;
    const lineWidth = 8 + bassIntensity * 6;
    const layers = 3;
    const invLayers = 1 / layers;
    const layerAngleStep = FlowFieldRenderer.TWO_PI * invLayers;
    const timeKnot = this.time * 0.002;
    const hueStep = 120;
    const tStep = 0.01;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const weave = (t: number, offset: number) => {
      const tOffset = t + offset;
      const sinTOffset = this.fastSin(tOffset);
      const cosTOffset = this.fastCos(tOffset);
      const sinSq = sinTOffset * sinTOffset;
      const denom = 1 + sinSq;
      const invDenom = 1 / denom;
      const x = size * cosTOffset * invDenom;
      const y = size * sinTOffset * cosTOffset * invDenom;
      return { x, y };
    };

    for (let layer = 0; layer < layers; layer++) {
      const offset = layerAngleStep * layer + timeKnot;
      const hue = this.fastMod360(this.hueBase + layer * hueStep);
      const hue30 = this.fastMod360(hue + 30);
      const hue60 = this.fastMod360(hue + 60);

      ctx.beginPath();
      for (let t = 0; t <= twoPi; t += tStep) {
        const pos = weave(t, offset);
        if (t === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      }

      const gradientAlpha1 = 0.7 + trebleIntensity * 0.2;
      const gradientAlpha2 = 0.9 + audioIntensity * 0.1;
      const gradient = ctx.createLinearGradient(-size, 0, size, 0);
      gradient.addColorStop(0, this.hsla(hue, 90, 70, gradientAlpha1));
      gradient.addColorStop(0.5, this.hsla(hue30, 95, 75, gradientAlpha2));
      gradient.addColorStop(1, this.hsla(hue60, 90, 70, gradientAlpha1));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderCosmicLotus(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const petalLayers = 5;
    const maxRadius = Math.min(this.width, this.height) * 0.4;

    for (let layer = petalLayers - 1; layer >= 0; layer--) {
      const petalsInLayer = 8 + layer * 2;
      const layerRadius = (maxRadius / petalLayers) * (layer + 1);
      const rotation = this.time * 0.001 * (layer % 2 === 0 ? 1 : -1);

      ctx.save();
      ctx.rotate(rotation);

      for (let petal = 0; petal < petalsInLayer; petal++) {
        const angle = (Math.PI * 2 * petal) / petalsInLayer;
        const hue =
          (this.hueBase + layer * 30 + petal * (360 / petalsInLayer)) % 360;

        ctx.save();
        ctx.rotate(angle);

        const petalWidth = layerRadius * 0.3;
        const petalLength = layerRadius * 0.6;
        const petalScale =
          1 + Math.sin(this.time * 0.005 + petal) * 0.1 + midIntensity * 0.15;

        ctx.scale(petalScale, petalScale);

        const petalGradient = ctx.createRadialGradient(
          0,
          petalLength * 0.3,
          0,
          0,
          petalLength * 0.3,
          petalWidth,
        );
        petalGradient.addColorStop(
          0,
          `hsla(${hue}, 90%, 75%, ${0.9 + audioIntensity * 0.1})`,
        );
        petalGradient.addColorStop(0.6, `hsla(${hue}, 85%, 65%, 0.8)`);
        petalGradient.addColorStop(1, `hsla(${hue}, 80%, 55%, 0.3)`);

        ctx.fillStyle = petalGradient;

        ctx.beginPath();
        ctx.ellipse(
          0,
          petalLength * 0.5,
          petalWidth * 0.4,
          petalLength * 0.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${0.6 + bassIntensity * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }

    const seedSize = maxRadius * 0.15 + bassIntensity * 10;

    const seedGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, seedSize);
    seedGradient.addColorStop(0, `hsla(${this.hueBase + 60}, 100%, 90%, 1)`);
    seedGradient.addColorStop(0.7, `hsla(${this.hueBase + 30}, 90%, 75%, 0.9)`);
    seedGradient.addColorStop(1, `hsla(${this.hueBase}, 80%, 60%, 0.7)`);

    ctx.fillStyle = seedGradient;
    ctx.beginPath();
    ctx.arc(0, 0, seedSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderVoidMandala(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const rings = 8;
    const maxRadius = Math.min(this.width, this.height) * 0.42;
    const invRings = 1 / rings;
    const timeRotation = this.time * 0.001;
    const timeLightness = this.time * 0.005;
    const timeAlpha = this.time * 0.003;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const baseHue = this.fastMod360(this.hueBase + 240);

    for (let ring = 0; ring < rings; ring++) {
      const radius = maxRadius * (ring + 1) * invRings;
      const segments = 6 + ring * 3;
      const invSegments = 1 / segments;
      const segmentAngleStep = twoPi * invSegments;
      const rotation = timeRotation * (ring & 1 ? -1 : 1);

      ctx.save();
      ctx.rotate(rotation);

      for (let seg = 0; seg < segments; seg++) {
        const angle = segmentAngleStep * seg;
        const nextAngle = segmentAngleStep * (seg + 1);

        const hue = this.fastMod360(baseHue + ring * 10 + seg * 5);

        const lightness =
          20 + ring * 5 + this.fastSin(timeLightness + seg) * 10;
        const alpha =
          0.5 + this.fastSin(timeAlpha + ring + seg) * 0.2 + midIntensity * 0.2;

        ctx.strokeStyle = this.hsla(hue, 70, lightness, alpha);
        ctx.lineWidth = 2 + (ring === rings - 1 ? bassIntensity * 3 : 0);

        ctx.beginPath();
        ctx.arc(0, 0, radius, angle, nextAngle);
        ctx.stroke();

        if (seg % 2 === 0) {
          const midAngle = (angle + nextAngle) * 0.5;
          const innerRadius = ring > 0 ? maxRadius * ring * invRings : 0;

          const cosMidAngle = this.fastCos(midAngle);
          const sinMidAngle = this.fastSin(midAngle);

          ctx.beginPath();
          ctx.moveTo(cosMidAngle * innerRadius, sinMidAngle * innerRadius);
          ctx.lineTo(cosMidAngle * radius, sinMidAngle * radius);
          ctx.stroke();

          const symbolX = cosMidAngle * radius;
          const symbolY = sinMidAngle * radius;
          const symbolSize = 4 + bassIntensity * 3;

          ctx.fillStyle = this.hsla(hue, 90, 70, alpha);
          ctx.beginPath();
          ctx.arc(symbolX, symbolY, symbolSize, 0, twoPi);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    const voidSize = maxRadius * 0.2;
    const voidHue = this.fastMod360(this.hueBase + 280);
    const voidAlpha = 0.8 + audioIntensity * 0.2;

    ctx.strokeStyle = this.hsla(voidHue, 90, 60, voidAlpha);
    ctx.lineWidth = 3 + bassIntensity * 4;
    ctx.setLineDash([5, 3]);

    ctx.beginPath();
    ctx.arc(0, 0, voidSize, 0, twoPi);
    ctx.stroke();
    ctx.setLineDash([]);

    const innerVoidHue280 = this.fastMod360(this.hueBase + 280);
    const innerVoidHue270 = this.fastMod360(this.hueBase + 270);
    const innerVoidHue260 = this.fastMod360(this.hueBase + 260);
    const innerVoid = ctx.createRadialGradient(0, 0, 0, 0, 0, voidSize);
    innerVoid.addColorStop(0, this.hsla(innerVoidHue280, 50, 5, 1));
    innerVoid.addColorStop(0.8, this.hsla(innerVoidHue270, 60, 10, 0.9));
    innerVoid.addColorStop(1, this.hsla(innerVoidHue260, 70, 20, 0.5));

    ctx.fillStyle = innerVoid;
    ctx.beginPath();
    ctx.arc(0, 0, voidSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderStellarMap(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const starCount = 50;
    const maxRadius = Math.min(this.width, this.height) * 0.45;
    const maxRadius025 = maxRadius * 0.25;
    const maxRadius025Sq = maxRadius025 * maxRadius025;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeTwinkle = this.time * 0.005;
    let rngSeed = (this.time * 1103515245 + 12345) & 0x7fffffff;

    if (this.stellarMapStars.length !== starCount) {
      this.stellarMapStars = [];
      for (let i = 0; i < starCount; i++) {
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const angle = (rngSeed / 0x7fffffff) * twoPi;
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const radius = (rngSeed / 0x7fffffff) * maxRadius;

        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const size = 2 + (rngSeed / 0x7fffffff) * 4;
        rngSeed = (rngSeed * 1664525 + 1013904223) & 0x7fffffff;
        const hue = this.fastMod360(this.hueBase + (rngSeed / 0x7fffffff) * 60);

        this.stellarMapStars.push({ x, y, size, hue });
      }
    }

    const stars = this.stellarMapStars;
    const connectionAlpha = 0.3 + trebleIntensity * 0.2;
    const connectionHue = this.fastMod360(this.hueBase + 180);

    ctx.strokeStyle = this.hsla(connectionHue, 70, 65, connectionAlpha);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);

    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const starI = stars[i];
        const starJ = stars[j];
        if (!starI || !starJ) continue;

        const dx = starJ.x - starI.x;
        const dy = starJ.y - starI.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxRadius025Sq) {
          ctx.beginPath();
          ctx.moveTo(starI.x, starI.y);
          ctx.lineTo(starJ.x, starJ.y);
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);

    stars.forEach((star, index) => {
      const twinkle =
        this.fastSin(timeTwinkle + index) * 0.3 + 0.7 + audioIntensity * 0.2;
      const dynamicSize = star.size + bassIntensity * 3;
      const glowSize = dynamicSize * 3;
      const twinkle08 = twinkle * 0.8;
      const twinkle04 = twinkle * 0.4;

      const glowGradient = ctx.createRadialGradient(
        star.x,
        star.y,
        0,
        star.x,
        star.y,
        glowSize,
      );
      glowGradient.addColorStop(0, this.hsla(star.hue, 90, 80, twinkle08));
      glowGradient.addColorStop(0.5, this.hsla(star.hue, 85, 70, twinkle04));
      glowGradient.addColorStop(1, this.hsla(star.hue, 80, 60, 0));

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(star.x, star.y, glowSize, 0, twoPi);
      ctx.fill();

      ctx.fillStyle = this.hsla(star.hue, 100, 90, twinkle);
      ctx.beginPath();
      ctx.arc(star.x, star.y, dynamicSize, 0, twoPi);
      ctx.fill();
    });

    const centerSize = 25 + bassIntensity * 15;
    const centerHue40 = this.fastMod360(this.hueBase + 40);
    const centerHue20 = this.fastMod360(this.hueBase + 20);
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerSize);
    centerGradient.addColorStop(0, this.hsla(centerHue40, 100, 85, 1));
    centerGradient.addColorStop(0.5, this.hsla(centerHue20, 95, 75, 0.9));
    centerGradient.addColorStop(1, this.hsla(this.hueBase, 90, 65, 0));

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderWyrdWeb(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.4;
    const norns = 3;

    for (let norn = 0; norn < norns; norn++) {
      const angle = (Math.PI * 2 * norn) / norns - Math.PI / 2;
      const hue = (this.hueBase + norn * 120) % 360;

      ctx.save();
      ctx.rotate(angle);

      const gradient = ctx.createLinearGradient(0, 0, 0, maxRadius);
      gradient.addColorStop(
        0,
        `hsla(${hue}, 80%, 60%, ${0.8 + audioIntensity * 0.2})`,
      );
      gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0.3)`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4 + bassIntensity * 4;
      ctx.lineCap = "round";

      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const progress = i / 50;
        const y = progress * maxRadius;
        const waveX = Math.sin(progress * Math.PI * 4 + this.time * 0.003) * 20;

        if (i === 0) ctx.moveTo(waveX, y);
        else ctx.lineTo(waveX, y);
      }
      ctx.stroke();

      ctx.restore();
    }

    const webLayers = 6;
    for (let layer = 1; layer <= webLayers; layer++) {
      const radius = (maxRadius / webLayers) * layer;
      const segments = norns * 4;

      ctx.strokeStyle = `hsla(${this.hueBase + layer * 20}, 75%, 65%, ${0.4 + midIntensity * 0.2})`;
      ctx.lineWidth = 1 + (layer === webLayers ? bassIntensity * 2 : 0);

      ctx.beginPath();
      for (let seg = 0; seg <= segments; seg++) {
        const angle = (Math.PI * 2 * seg) / segments;
        const waveRadius =
          radius + Math.sin(angle * 3 + this.time * 0.002) * 10;
        const x = Math.cos(angle) * waveRadius;
        const y = Math.sin(angle) * waveRadius;

        if (seg === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    const wellSize = 40 + bassIntensity * 20;
    const wellGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, wellSize);
    wellGradient.addColorStop(0, `hsla(${this.hueBase}, 70%, 30%, 1)`);
    wellGradient.addColorStop(0.6, `hsla(${this.hueBase + 30}, 80%, 50%, 0.8)`);
    wellGradient.addColorStop(1, `hsla(${this.hueBase + 60}, 90%, 70%, 0.3)`);

    ctx.fillStyle = wellGradient;
    ctx.beginPath();
    ctx.arc(0, 0, wellSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderSpiritualGateway(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const gatewayHeight = Math.min(this.width, this.height) * 0.7;
    const gatewayWidth = gatewayHeight * 0.5;
    const archRadius = gatewayWidth / 2;
    const pillarHeight = gatewayHeight * 0.6;
    const pillarWidth = archRadius * 0.3;

    ctx.save();
    ctx.translate(-archRadius - pillarWidth / 2, pillarHeight / 2);

    const leftPillarGradient = ctx.createLinearGradient(
      -pillarWidth / 2,
      0,
      pillarWidth / 2,
      0,
    );
    leftPillarGradient.addColorStop(0, `hsla(${this.hueBase}, 70%, 50%, 0.3)`);
    leftPillarGradient.addColorStop(
      0.5,
      `hsla(${this.hueBase + 20}, 80%, 60%, ${0.7 + bassIntensity * 0.2})`,
    );
    leftPillarGradient.addColorStop(
      1,
      `hsla(${this.hueBase + 40}, 70%, 50%, 0.3)`,
    );

    ctx.fillStyle = leftPillarGradient;
    ctx.fillRect(
      -pillarWidth / 2,
      -pillarHeight / 2,
      pillarWidth,
      pillarHeight,
    );

    ctx.restore();

    ctx.save();
    ctx.translate(archRadius + pillarWidth / 2, pillarHeight / 2);

    ctx.fillStyle = leftPillarGradient;
    ctx.fillRect(
      -pillarWidth / 2,
      -pillarHeight / 2,
      pillarWidth,
      pillarHeight,
    );

    ctx.restore();

    ctx.save();
    ctx.translate(0, -pillarHeight / 2);

    ctx.strokeStyle = `hsla(${this.hueBase + 30}, 85%, 65%, ${0.8 + audioIntensity * 0.2})`;
    ctx.lineWidth = pillarWidth * 0.8;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(0, 0, archRadius, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    const portalCenterY = 0;
    const portalRadius = archRadius * 0.85;

    const portalLayers = 8;
    for (let layer = 0; layer < portalLayers; layer++) {
      const layerRadius =
        (portalRadius / portalLayers) * (portalLayers - layer);
      const rotation =
        this.time * 0.002 * (layer % 2 === 0 ? 1 : -1) * (layer + 1);

      ctx.save();
      ctx.translate(0, portalCenterY);
      ctx.rotate(rotation);

      const hue = (this.hueBase + 120 + layer * 30) % 360;
      const alpha = 0.15 + (layer / portalLayers) * 0.3 + midIntensity * 0.2;

      const layerGradient = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        layerRadius,
      );
      layerGradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0)`);
      layerGradient.addColorStop(0.5, `hsla(${hue}, 85%, 65%, ${alpha})`);
      layerGradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);

      ctx.fillStyle = layerGradient;
      ctx.beginPath();
      ctx.arc(0, 0, layerRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    const centerLight = 30 + bassIntensity * 25;
    const centerGradient = ctx.createRadialGradient(
      0,
      portalCenterY,
      0,
      0,
      portalCenterY,
      centerLight,
    );
    centerGradient.addColorStop(
      0,
      `hsla(${this.hueBase + 180}, 100%, 95%, ${0.9 + audioIntensity * 0.1})`,
    );
    centerGradient.addColorStop(
      0.4,
      `hsla(${this.hueBase + 160}, 95%, 85%, 0.7)`,
    );
    centerGradient.addColorStop(
      0.7,
      `hsla(${this.hueBase + 140}, 90%, 75%, 0.4)`,
    );
    centerGradient.addColorStop(1, `hsla(${this.hueBase + 120}, 85%, 65%, 0)`);

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, portalCenterY, centerLight, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderAkashicRecords(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const bookWidth = Math.min(this.width, this.height) * 0.5;
    const bookHeight = bookWidth * 1.3;

    const coverGradient = ctx.createLinearGradient(
      -bookWidth / 2,
      0,
      bookWidth / 2,
      0,
    );
    coverGradient.addColorStop(0, `hsla(${this.hueBase}, 60%, 30%, 0.9)`);
    coverGradient.addColorStop(0.5, `hsla(${this.hueBase + 30}, 70%, 40%, 1)`);
    coverGradient.addColorStop(1, `hsla(${this.hueBase + 60}, 60%, 30%, 0.9)`);

    ctx.fillStyle = coverGradient;
    ctx.fillRect(-bookWidth / 2, -bookHeight / 2, bookWidth, bookHeight);

    ctx.strokeStyle = `hsla(${this.hueBase + 40}, 80%, 60%, ${0.8 + audioIntensity * 0.2})`;
    ctx.lineWidth = 4 + bassIntensity * 3;
    ctx.strokeRect(
      -bookWidth / 2 + 10,
      -bookHeight / 2 + 10,
      bookWidth - 20,
      bookHeight - 20,
    );

    const circleRadius = bookHeight * 0.05;
    ctx.strokeStyle = `hsla(${this.hueBase + 60}, 90%, 70%, ${0.6 + trebleIntensity * 0.3})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = Math.cos(angle) * circleRadius;
      const y = Math.sin(angle) * circleRadius;

      ctx.beginPath();
      ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = `hsla(${this.hueBase + 180}, 95%, 80%, ${0.9 + audioIntensity * 0.1})`;
    ctx.font = `${bookHeight * 0.08}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("∞ AKASHA ∞", 0, -bookHeight * 0.35);

    const textLines = 8;
    const textStartY = -bookHeight * 0.15;
    const lineHeight = (bookHeight * 0.5) / textLines;

    for (let line = 0; line < textLines; line++) {
      const y = textStartY + line * lineHeight;
      const lineAlpha =
        0.4 + Math.sin(this.time * 0.003 + line) * 0.2 + trebleIntensity * 0.2;

      ctx.fillStyle = `hsla(${this.hueBase + 180}, 90%, 75%, ${lineAlpha})`;
      ctx.font = `${bookHeight * 0.04}px monospace`;

      const symbols = "⚹⚺⚻⚼☉☊☋☌☍⊕⊗⊙";
      let textLine = "";
      for (let i = 0; i < 15; i++) {
        textLine +=
          symbols[((this.time * 0.001 + line + i) % symbols.length) | 0];
      }

      ctx.fillText(textLine, 0, y);
    }

    ctx.restore();
  }

  private renderSacredGeometry(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.42;

    ctx.strokeStyle = `hsla(${this.hueBase}, 80%, 65%, ${0.7 + audioIntensity * 0.2})`;
    ctx.lineWidth = 2 + bassIntensity * 2;
    ctx.beginPath();
    ctx.arc(0, 0, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${this.hueBase + 60}, 85%, 70%, ${0.7 + midIntensity * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const x = Math.cos(angle) * maxRadius * 0.85;
      const y = Math.sin(angle) * maxRadius * 0.85;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const triangleRadius = maxRadius * 0.65;
    ctx.strokeStyle = `hsla(${this.hueBase + 120}, 90%, 75%, ${0.7 + bassIntensity * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const angle = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      const x = Math.cos(angle) * triangleRadius;
      const y = Math.sin(angle) * triangleRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = `hsla(${this.hueBase + 180}, 90%, 75%, ${0.7 + bassIntensity * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const angle = (Math.PI * 2 * i) / 3 + Math.PI / 2;
      const x = Math.cos(angle) * triangleRadius;
      const y = Math.sin(angle) * triangleRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const seedRadius = maxRadius * 0.3;
    ctx.strokeStyle = `hsla(${this.hueBase + 240}, 85%, 70%, ${0.5 + midIntensity * 0.2})`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, seedRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = Math.cos(angle) * seedRadius;
      const y = Math.sin(angle) * seedRadius;

      ctx.beginPath();
      ctx.arc(x, y, seedRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const coreSize = 20 + bassIntensity * 15;
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize);
    coreGradient.addColorStop(0, `hsla(${this.hueBase}, 100%, 95%, 1)`);
    coreGradient.addColorStop(0.4, `hsla(${this.hueBase + 40}, 95%, 85%, 0.9)`);
    coreGradient.addColorStop(0.7, `hsla(${this.hueBase + 80}, 90%, 75%, 0.6)`);
    coreGradient.addColorStop(1, `hsla(${this.hueBase + 120}, 85%, 65%, 0)`);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderShadowRealm(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    const maxRadius =
      (this.width < this.height ? this.width : this.height) * 0.48;
    const layers = 8; // DRASTICALLY reduced from 18 (56% reduction!)
    const invLayers = 1 / layers;
    const t = this.time | 0;
    const bass = (bassIntensity * 15) | 0;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeLightness = t * 0.012;
    const timeAlpha = t * 0.009;
    const voidHue270 = this.fastMod360(this.hueBase + 270);

    const baseLineWidth = 3.5;

    // Firefox EXTREME optimization: NO shadows on layers, simple circles only
    ctx.shadowBlur = 0;

    for (let layer = 0; layer < layers; layer++) {
      const radius = maxRadius * (layer + 1) * invLayers;
      const rotSign = ((layer & 1) << 1) - 1;
      const rotation = t * 0.0025 * rotSign * (1 + bassIntensity * 2);

      const hue = this.fastMod360(this.hueBase + 270 + (layer << 2));
      const isOuterLayer = layer === layers - 1;
      const lineWidth = baseLineWidth + (isOuterLayer ? bass : bass * 0.3);

      ctx.save();
      ctx.rotate(rotation);

      ctx.lineWidth = lineWidth;

      const avgLightness = (8 + this.fastSin(timeLightness + layer) * 18) | 0;
      const avgAlpha =
        0.7 + this.fastSin(timeAlpha) * 0.4 + trebleIntensity * 0.8;

      ctx.strokeStyle = this.hsla(hue, 85, avgLightness, avgAlpha);

      // Simple circle instead of arc segments (much faster!)
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.stroke();

      ctx.restore();
    }

    // Center void - NO gradient, simple fill only
    const voidCoreRadius = maxRadius * 0.35;
    ctx.fillStyle = this.hsla(voidHue270, 75, 10, 0.9);
    ctx.shadowBlur = 0; // NO shadow
    ctx.beginPath();
    ctx.arc(0, 0, voidCoreRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderQuantumEntanglement(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const pi = Math.PI;
    const t = this.time | 0;
    const minDim = this.width < this.height ? this.width : this.height;
    const maxRadius = minDim * 0.48;

    const areaScale = (this.width * this.height) / (1280 * 720);
    const areaPenalty = areaScale > 1 ? Math.min(areaScale, 3.2) : 1;
    const basePairs = 14;
    const extraPairs = (midIntensity * 10) | 0;
    const particlePairs = Math.max(
      10,
      ((basePairs + extraPairs) / areaPenalty) | 0,
    );
    const invParticlePairs = 1 / particlePairs;
    const angleStep = twoPi * invParticlePairs;

    const stride = areaPenalty > 2.0 ? 3 : audioIntensity < 0.55 ? 2 : 1;
    const phase = (t >> 5) % stride;

    const timeAngle = t * 0.0032;
    const timeAngle2 = t * 0.006;
    const timeRadius = t * 0.008;
    const timeCurl = t * 0.01;

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.5 + bassIntensity * 2.2;
    ctx.shadowBlur = 10 + midIntensity * 10;

    const alpha = 0.35 + midIntensity * 0.35;

    for (let i = phase; i < particlePairs; i += stride) {
      const angle1 = angleStep * i + timeAngle;
      const angle2 = angle1 + pi + this.fastSin(timeAngle2 + i) * 0.55;

      const radius1 = maxRadius * (0.28 + this.fastSin(timeRadius + i) * 0.28);
      const radius2 =
        maxRadius * (0.28 + this.fastSin(timeRadius + i + pi) * 0.28);

      const x1 = this.fastCos(angle1) * radius1;
      const y1 = this.fastSin(angle1) * radius1;
      const x2 = this.fastCos(angle2) * radius2;
      const y2 = this.fastSin(angle2) * radius2;

      const hue = this.fastMod360(this.hueBase + 190 + i * 11);
      ctx.shadowColor = this.hsla(hue, 95, 65, 0.35);
      ctx.strokeStyle = this.hsla(hue, 95, 70, alpha);

      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      const curl = 22 + midIntensity * 30;
      const cx = mx + this.fastCos(timeCurl + i) * curl;
      const cy = my + this.fastSin(timeCurl + i) * curl;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();

      const s1 = 2 + ((bassIntensity * 3) | 0);
      const s2 = 2 + ((midIntensity * 3) | 0);
      ctx.fillStyle = this.hsla(hue, 100, 85, 0.55 + alpha * 0.35);
      ctx.fillRect(x1 - s1, y1 - s1, s1 + s1, s1 + s1);
      ctx.fillStyle = this.hsla(
        this.fastMod360(hue + 70),
        100,
        85,
        0.55 + alpha * 0.35,
      );
      ctx.fillRect(x2 - s2, y2 - s2, s2 + s2, s2 + s2);
    }

    ctx.globalCompositeOperation = "source-over";

    ctx.restore();
  }

  private renderNecromanticSigil(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius =
      (this.width < this.height ? this.width : this.height) * 0.42;
    const sigilPoints = 17;
    const invSigilPoints = 1 / sigilPoints;
    const t = this.time | 0;
    const bass = (bassIntensity * 3) | 0;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const halfPi = Math.PI * 0.5;
    const angleStep = twoPi * invSigilPoints;
    const timeRadius = t * 0.003;
    const hue1 = this.fastMod360(this.hueBase + 320);
    const hue2 = this.fastMod360(this.hueBase + 340);
    const hue1Plus10 = this.fastMod360(hue1 + 10);
    const strokeAlpha1 = 0.9 + audioIntensity * 0.3;
    const strokeAlpha2 = 0.95 + midIntensity * 0.2;

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < sigilPoints; i++) {
      const angle = angleStep * i - halfPi;

      const radius = maxRadius * (0.7 + this.fastSin(timeRadius + i) * 0.15);
      points.push({
        x: this.fastCos(angle) * radius,
        y: this.fastSin(angle) * radius,
      });
    }

    // Batch all inner lines into a single path (Firefox optimization)
    ctx.strokeStyle = this.hsla(hue1, 90, 40, strokeAlpha1);
    ctx.lineWidth = (3 + bass) | 0;
    ctx.shadowBlur = 20; // Reduced from 35 for better Firefox performance
    ctx.shadowColor = this.hsla(hue1, 100, 45, 0.7); // Reduced alpha from 0.95

    ctx.beginPath();
    for (let i = 0; i < sigilPoints; i++) {
      for (let j = (i + 1) | 0; j < sigilPoints; j++) {
        if (((i + j) & 3) === 0) {
          const pointI = points[i];
          const pointJ = points[j];
          if (pointI && pointJ) {
            ctx.moveTo(pointI.x, pointI.y);
            ctx.lineTo(pointJ.x, pointJ.y);
          }
        }
      }
    }
    ctx.stroke();

    // Outer circle
    ctx.strokeStyle = this.hsla(hue2, 95, 50, strokeAlpha2);
    ctx.lineWidth = 4;
    ctx.shadowBlur = 25; // Reduced from implicit shadow
    ctx.shadowColor = this.hsla(hue2, 100, 50, 0.8);
    const outerRadius = maxRadius * 0.85;
    ctx.beginPath();
    for (let i = 0; i <= sigilPoints; i++) {
      const angle = angleStep * i - halfPi;

      const x = this.fastCos(angle) * outerRadius;
      const y = this.fastSin(angle) * outerRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Center glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = this.hsla(hue1, 100, 50, 0.9);
    const centerSize = (20 + bass * 2) | 0;
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerSize);
    centerGradient.addColorStop(0, this.hsla(hue1, 100, 55, 1));
    centerGradient.addColorStop(0.5, this.hsla(hue1Plus10, 95, 45, 0.9));
    centerGradient.addColorStop(1, this.hsla(hue2, 85, 35, 0));

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, centerSize, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderDimensionalRift(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius =
      (this.width < this.height ? this.width : this.height) * 0.48;
    const riftCount = 12;
    const invRiftCount = 1 / riftCount;
    const t = this.time | 0;
    const bass = (bassIntensity * 4) | 0;
    const treb = (trebleIntensity * 5) | 0;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const riftAngleStep = twoPi * invRiftCount;
    const timeRift = t * 0.0015;
    const timeDistortion = t * 0.0075;
    const maxRadius02 = maxRadius * 0.2;
    const maxRadius025 = maxRadius * 0.25;

    // Firefox optimization: Draw rifts with reduced shadow, only on odd iterations
    const width = (25 + bass * 2) | 0;

    for (let rift = 0; rift < riftCount; rift++) {
      const angle = riftAngleStep * rift + timeRift;
      const distortion = this.fastSin(timeDistortion + rift) * 0.4;

      const hue1 = this.fastMod360(
        this.hueBase + 200 + (rift << 4) + (rift << 2),
      );
      const hue2 = this.fastMod360(hue1 + 20);

      const cosA = this.fastCos(angle);
      const sinA = this.fastSin(angle);
      const angleDistorted = angle + distortion;
      const cosAD = this.fastCos(angleDistorted);
      const sinAD = this.fastSin(angleDistorted);

      const gradient = ctx.createLinearGradient(
        cosA * maxRadius02,
        sinA * maxRadius02,
        cosAD * maxRadius,
        sinAD * maxRadius,
      );
      const gradientAlpha1 = 0.5 + treb * 0.05;
      const gradientAlpha2 = 0.7 + audioIntensity * 0.4;
      const gradientAlpha3 = 0.3 + treb * 0.03;
      gradient.addColorStop(0, this.hsla(hue1, 100, 65, gradientAlpha1));
      gradient.addColorStop(0.5, this.hsla(hue2, 100, 75, gradientAlpha2));
      gradient.addColorStop(1, this.hsla(hue1, 100, 55, gradientAlpha3));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;

      // Only apply shadow to every other rift (6 instead of 12 shadow operations)
      // and reduce blur from 40 to 25
      if ((rift & 1) === 0) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = this.hsla(hue1, 100, 65, 0.6);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(cosA * maxRadius02, sinA * maxRadius02);
      ctx.lineTo(cosAD * maxRadius, sinAD * maxRadius);
      ctx.stroke();
    }

    // Reset shadow for center
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.hsla(this.hueBase + 210, 100, 70, 0.7);

    const centerHue210 = this.fastMod360(this.hueBase + 210);
    const centerHue200 = this.fastMod360(this.hueBase + 200);
    const centerHue190 = this.fastMod360(this.hueBase + 190);
    const centerRift = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius025);
    centerRift.addColorStop(
      0,
      this.hsla(centerHue210, 100, 85, 0.95 + audioIntensity * 0.2),
    );
    centerRift.addColorStop(
      0.7,
      this.hsla(centerHue200, 100, 65, 0.6 + bassIntensity * 0.4),
    );
    centerRift.addColorStop(1, this.hsla(centerHue190, 100, 45, 0));

    ctx.fillStyle = centerRift;
    ctx.beginPath();
    ctx.arc(0, 0, maxRadius025, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderChaosVortex(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius =
      (this.width < this.height ? this.width : this.height) * 0.5;
    const spirals = 6; // Firefox: Reduced from 12 (50% reduction)
    const pointsPerSpiral = 80; // Firefox: Reduced from 180-320 (75% reduction!)
    const invPointsPerSpiral = 1 / pointsPerSpiral;
    const t = this.time | 0;
    const bass = (bassIntensity * 8) | 0;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const spiralAngleStep = twoPi / spirals;
    const pi12 = Math.PI * 12;
    const timeRotation = t * 0.007;
    const timeRadius = t * 0.009;
    const timeChaos = t * 0.025;
    const chaosMultiplier = (1 + bassIntensity * 2) * 12;
    const spiralAlpha = 0.75 + midIntensity * 0.6;
    const lineWidth = 3 + bass;

    let radiusModulations = this.chaosVortexRadiusMods;
    if (radiusModulations.length < spirals) {
      radiusModulations = new Float32Array(spirals);
      this.chaosVortexRadiusMods = radiusModulations;
    }
    for (let s = 0; s < spirals; s++) {
      radiusModulations[s] = 0.8 + this.fastSin(timeRadius + s) * 0.35;
    }

    // Firefox: NO shadows on spirals
    ctx.shadowBlur = 0;
    ctx.lineWidth = lineWidth;

    for (let spiral = 0; spiral < spirals; spiral++) {
      const spiralOffset = spiralAngleStep * spiral;
      const hue = this.fastMod360(this.hueBase + 30 + (spiral << 7));
      const rotSign = ((spiral & 1) << 1) - 1;
      const radiusMod = radiusModulations[spiral]! * maxRadius;
      const spiralTimeRot = timeRotation * rotSign;
      const chaosOffset = timeChaos + (spiral << 2);

      ctx.strokeStyle = this.hsla(hue, 100, 60, spiralAlpha);

      ctx.beginPath();

      for (let i = 0; i < pointsPerSpiral; i++) {
        const tVal = i * invPointsPerSpiral;
        const angle = tVal * pi12 + spiralOffset + spiralTimeRot;

        const cosAngle = this.fastCos(angle);
        const sinAngle = this.fastSin(angle);

        const cosAngle90 = -sinAngle;
        const sinAngle90 = cosAngle;

        const radius = tVal * radiusMod;
        const chaos = this.fastSin(chaosOffset + tVal * 16) * chaosMultiplier;

        const x = cosAngle * radius + cosAngle90 * chaos;
        const y = sinAngle * radius + sinAngle90 * chaos;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Firefox: Simple center fill, no gradient, minimal shadow
    const coreRadius = maxRadius * 0.25;
    const coreHue = this.fastMod360(this.hueBase + 50);

    ctx.fillStyle = this.hsla(coreHue, 100, 90, 0.95);
    ctx.shadowBlur = 15; // Reduced from 60
    ctx.shadowColor = this.hsla(coreHue, 100, 80, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderEtherealMist(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.55;
    const mistParticles = 40; // DRASTICALLY reduced from 180 (78% reduction!)
    const invMistParticles = 1 / mistParticles;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const particleAngleStep = twoPi * invMistParticles;
    const timeRadius = this.time * 0.005;
    const timeMovement = this.time * 0.0015;
    const timeSize = this.time * 0.007;
    const timeAlpha = this.time * 0.008;
    const maxRadius018 = maxRadius * 0.18;

    // Firefox optimization: NO gradients, NO shadows, simple fills only
    ctx.shadowBlur = 0;

    for (let i = 0; i < mistParticles; i++) {
      const angle = particleAngleStep * i + timeMovement;
      const baseRadius = maxRadius * (0.15 + (i % 5) * 0.12);

      const radius =
        baseRadius + this.fastSin(timeRadius + i * 0.15) * maxRadius018;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const hue = this.fastMod360(this.hueBase + 150 + i * 3);

      const size = 14 + this.fastSin(timeSize + i) * 8 + trebleIntensity * 12;
      const alpha =
        0.5 + this.fastSin(timeAlpha + i) * 0.3 + trebleIntensity * 0.4;

      // Simple fill, no gradient (much faster)
      ctx.fillStyle = this.hsla(hue, 85, 88, alpha);
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }

    ctx.restore();
  }

  private renderBloodMoon(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.4;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeMoon = this.time * 0.001;
    const timeShadow = this.time * 0.0008;
    const timeRays = this.time * 0.0005;
    const timeRayLength = this.time * 0.003;

    const moonRadius = maxRadius * (0.7 + this.fastSin(timeMoon) * 0.1);

    const moonHue350 = this.fastMod360(this.hueBase + 350);
    const moonHue340 = this.fastMod360(this.hueBase + 340);
    const moonHue330 = this.fastMod360(this.hueBase + 330);
    const moonHue320 = this.fastMod360(this.hueBase + 320);
    const moonHue10 = this.fastMod360(this.hueBase + 10);

    const auraRings = 5 + ((bassIntensity * 2) | 0);
    const auraHue = this.fastMod360(this.hueBase + 345);
    const auraAlpha = 0.15 + midIntensity * 0.15;

    ctx.save();
    ctx.strokeStyle = this.hsla(auraHue, 85, 42, auraAlpha);
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.hsla(auraHue, 90, 45, auraAlpha * 0.8);

    for (let ar = 0; ar < auraRings; ar++) {
      const auraRadius =
        moonRadius * (1.15 + ar * 0.12) +
        this.fastSin(this.time * 0.004 + ar) * 8;
      ctx.lineWidth = 2 - ar * 0.2 + audioIntensity * 1.5;
      ctx.globalAlpha = auraAlpha * (1 - (ar / auraRings) * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, twoPi);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const dropletCount = 25 + ((midIntensity * 15) | 0);
    const dropletHue = this.fastMod360(this.hueBase + 355);
    const dropletAlpha = 0.4 + audioIntensity * 0.3;

    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.hsla(dropletHue, 95, 48, dropletAlpha * 0.7);
    ctx.fillStyle = this.hsla(dropletHue, 88, 45, dropletAlpha);

    for (let d = 0; d < dropletCount; d++) {
      const dropletOrbit = moonRadius * (1.4 + (d % 4) * 0.18);
      const dropletAngle = this.fastMod360(d * 13.7 + this.time * 0.09);
      const dropletPulse = 1 + this.fastSin(this.time * 0.015 + d * 0.5) * 0.12;
      const dropletX = this.fastCos(dropletAngle) * dropletOrbit * dropletPulse;
      const dropletY =
        this.fastSin(dropletAngle) * dropletOrbit * dropletPulse +
        this.fastSin(this.time * 0.012 + d) * 15;
      const dropletSize = 2.5 + (d % 3) * 0.8 + bassIntensity * 1.8;

      ctx.beginPath();
      ctx.arc(dropletX, dropletY, dropletSize, 0, twoPi);
      ctx.fill();
    }
    ctx.restore();
    const moonGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, moonRadius);
    moonGradient.addColorStop(
      0,
      this.hsla(moonHue350, 100, 45, 0.95 + audioIntensity * 0.05),
    );
    moonGradient.addColorStop(
      0.3,
      this.hsla(moonHue340, 95, 40, 0.9 + midIntensity * 0.1),
    );
    moonGradient.addColorStop(
      0.7,
      this.hsla(moonHue330, 90, 35, 0.8 + bassIntensity * 0.1),
    );
    moonGradient.addColorStop(
      1,
      this.hsla(moonHue320, 85, 30, 0.6 + audioIntensity * 0.2),
    );

    ctx.fillStyle = moonGradient;
    ctx.shadowBlur = 40;
    ctx.shadowColor = this.hsla(moonHue350, 100, 40, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, moonRadius, 0, twoPi);
    ctx.fill();

    const shadowRadius = moonRadius * 0.6;
    const shadowRadius03 = shadowRadius * 0.3;
    const shadowRadius15 = shadowRadius * 1.5;

    const shadowCos = this.fastCos(timeShadow);
    const shadowSin = this.fastSin(timeShadow);
    const shadowX = shadowCos * shadowRadius03;
    const shadowY = shadowSin * shadowRadius03;
    const shadowGradient = ctx.createRadialGradient(
      shadowX,
      shadowY,
      0,
      shadowX,
      shadowY,
      shadowRadius15,
    );
    shadowGradient.addColorStop(
      0,
      this.hsla(moonHue10, 80, 15, 0.9 + bassIntensity * 0.1),
    );
    shadowGradient.addColorStop(1, this.hsla(moonHue350, 70, 25, 0));

    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.arc(shadowX, shadowY, shadowRadius15, 0, twoPi);
    ctx.fill();

    const craterCount = 10 + ((bassIntensity * 5) | 0);
    const craterHue = this.fastMod360(this.hueBase + 335);
    const craterAlpha = 0.35 + midIntensity * 0.2;

    ctx.save();
    ctx.fillStyle = this.hsla(craterHue, 75, 28, craterAlpha);
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.hsla(craterHue, 80, 25, craterAlpha * 0.9);

    for (let cr = 0; cr < craterCount; cr++) {
      const craterAngle = this.fastMod360(cr * 28.4);
      const craterDist = moonRadius * (0.3 + (cr % 7) * 0.08);
      const crX = this.fastCos(craterAngle) * craterDist;
      const crY = this.fastSin(craterAngle) * craterDist;
      const craterSize = 8 + (cr % 4) * 3 + bassIntensity * 4;

      ctx.beginPath();
      ctx.arc(crX, crY, craterSize, 0, twoPi);
      ctx.fill();

      ctx.strokeStyle = this.hsla(craterHue, 70, 32, craterAlpha * 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(crX, crY, craterSize * 1.2, 0, twoPi);
      ctx.stroke();
    }
    ctx.restore();

    const wispCount = 15 + ((audioIntensity * 7) | 0);
    const wispHue = this.fastMod360(this.hueBase + 352);
    const wispAlpha = 0.3 + midIntensity * 0.25;

    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = this.hsla(wispHue, 92, 48, wispAlpha * 0.7);
    ctx.fillStyle = this.hsla(wispHue, 88, 46, wispAlpha);

    for (let w = 0; w < wispCount; w++) {
      const wispOrbit = moonRadius * (0.92 + (w % 3) * 0.08);
      const wispAngle = this.fastMod360(w * 22.5 + this.time * 0.13);
      const wispPulse = 1 + this.fastSin(this.time * 0.016 + w * 0.8) * 0.18;
      const wispX = this.fastCos(wispAngle) * wispOrbit * wispPulse;
      const wispY = this.fastSin(wispAngle) * wispOrbit * wispPulse;
      const wispSize = 3 + (w % 3) * 0.7 + bassIntensity * 2;

      ctx.beginPath();
      ctx.arc(wispX, wispY, wispSize, 0, twoPi);
      ctx.fill();
    }
    ctx.restore();

    const rays = 16;
    const invRays = 1 / rays;
    const rayAngleStep = twoPi * invRays;
    ctx.strokeStyle = this.hsla(moonHue350, 90, 50, 0.4 + midIntensity * 0.3);
    ctx.lineWidth = 2 + bassIntensity * 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.hsla(moonHue350, 100, 45, 0.7);

    for (let i = 0; i < rays; i++) {
      const angle = rayAngleStep * i + timeRays;

      const rayLength =
        maxRadius * (0.8 + this.fastSin(timeRayLength + i) * 0.2);
      const cosAngle = this.fastCos(angle);
      const sinAngle = this.fastSin(angle);

      ctx.beginPath();
      ctx.moveTo(cosAngle * moonRadius, sinAngle * moonRadius);
      ctx.lineTo(cosAngle * rayLength, sinAngle * rayLength);
      ctx.stroke();
    }

    if (bassIntensity > 0.25) {
      const secondaryHue = this.fastMod360(this.hueBase + 348);
      const secondaryAlpha = 0.25 + bassIntensity * 0.3;
      ctx.strokeStyle = this.hsla(secondaryHue, 85, 48, secondaryAlpha);
      ctx.lineWidth = 1.5 + bassIntensity * 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.hsla(secondaryHue, 95, 50, secondaryAlpha * 0.8);

      for (let i = 0; i < rays; i++) {
        const angle = rayAngleStep * i + rayAngleStep * 0.5 + timeRays;
        const secondaryLength =
          maxRadius *
          (0.6 +
            bassIntensity * 0.25 +
            this.fastSin(timeRayLength + i + rays) * 0.15);
        const cosAngle = this.fastCos(angle);
        const sinAngle = this.fastSin(angle);

        ctx.beginPath();
        ctx.moveTo(cosAngle * moonRadius * 1.05, sinAngle * moonRadius * 1.05);
        ctx.lineTo(cosAngle * secondaryLength, sinAngle * secondaryLength);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderDarkMatter(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const pixelCount = this.width * this.height;
    const detailScale = Math.max(
      0.35,
      Math.min(
        1,
        this.getAdaptiveDetailScale(pixelCount) * (this.isFirefox ? 0.6 : 1),
      ),
    );
    const lowDetail = detailScale < 0.8;
    const shadowScale = detailScale;
    const useShadows = detailScale >= 0.85 && !this.isFirefox;

    const maxRadius = Math.min(this.width, this.height) * 0.48;
    const matterParticles = Math.max(
      28,
      ((80 + ((bassIntensity * 40) | 0)) * detailScale) | 0,
    );
    const invMatterParticles = 1 / matterParticles;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const particleAngleStep = twoPi * invMatterParticles;
    const timeAngle = this.time * 0.0003;
    const timeRadius = this.time * 0.004;
    const timeSize = this.time * 0.005;
    const timeAlpha = this.time * 0.003;
    const timeGravity = this.time * 0.002;
    const maxRadius015 = maxRadius * 0.15;
    const darkHue240 = this.fastMod360(this.hueBase + 240);
    const darkHue250 = this.fastMod360(this.hueBase + 250);
    const darkHue230 = this.fastMod360(this.hueBase + 230);
    const darkHue260 = this.fastMod360(this.hueBase + 260);

    const voidCount = Math.max(
      10,
      ((35 + ((trebleIntensity * 20) | 0)) * detailScale) | 0,
    );
    const voidHue = this.fastMod360(this.hueBase + 245);
    const voidAlpha = 0.2 + audioIntensity * 0.15;
    ctx.fillStyle = this.hsla(voidHue, 25, 10, voidAlpha);
    ctx.shadowBlur = useShadows ? 15 * shadowScale : 0;
    ctx.shadowColor = this.hsla(voidHue, 35, 15, voidAlpha * 0.8);

    for (let v = 0; v < voidCount; v++) {
      const voidRadius = maxRadius * 0.08 + (v % 12) * maxRadius * 0.012;
      const voidAngle = this.fastMod360(v * 21.3 + this.time * 0.05);
      const voidPulse = 1 + this.fastSin(this.time * 0.008 + v * 0.7) * 0.2;
      const voidX = this.fastCos(voidAngle) * voidRadius * voidPulse;
      const voidY = this.fastSin(voidAngle) * voidRadius * voidPulse;
      const voidSize =
        (2 + (v % 4) * 0.6 + bassIntensity * 1.5) * (0.8 + detailScale * 0.25);

      ctx.beginPath();
      ctx.arc(voidX, voidY, voidSize, 0, twoPi);
      ctx.fill();
    }

    ctx.shadowBlur = useShadows ? (25 + bassIntensity * 15) * shadowScale : 0;
    ctx.shadowColor = this.hsla(darkHue240, 60, 30, 0.8);
    for (let i = 0; i < matterParticles; i++) {
      const angle = particleAngleStep * i + timeAngle;
      const baseRadius = maxRadius * (0.1 + (i % 5) * 0.12);

      const radius =
        baseRadius + this.fastSin(timeRadius + i * 0.2) * maxRadius015;
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const size = Math.max(
        1,
        (3 + this.fastSin(timeSize + i) * 2 + trebleIntensity * 2) *
          (0.75 + detailScale * 0.35),
      );
      const alpha = Math.max(
        0.08,
        Math.min(
          0.95,
          0.3 + this.fastSin(timeAlpha + i) * 0.2 + trebleIntensity * 0.3,
        ),
      );

      ctx.fillStyle = this.hsla(darkHue240, 40, 20, alpha);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, twoPi);
      ctx.fill();
    }

    const streamCount = Math.max(
      5,
      ((15 + ((audioIntensity * 10) | 0)) * detailScale) | 0,
    );
    const streamHue = this.fastMod360(this.hueBase + 235);
    const streamAlpha = 0.15 + trebleIntensity * 0.15;

    ctx.save();
    ctx.strokeStyle = this.hsla(streamHue, 45, 22, streamAlpha);
    ctx.lineWidth = (1.5 + bassIntensity * 1) * (0.7 + detailScale * 0.3);
    ctx.shadowBlur = useShadows ? 12 * shadowScale : 0;
    ctx.shadowColor = this.hsla(streamHue, 55, 28, streamAlpha * 0.8);

    for (let st = 0; st < streamCount; st++) {
      const streamAngle1 = this.fastMod360(st * 23.7 + this.time * 0.07);
      const streamAngle2 = this.fastMod360(st * 23.7 + 180 + this.time * 0.07);
      const streamRadius1 = maxRadius * (0.25 + (st % 4) * 0.12);
      const streamRadius2 = maxRadius * (0.35 + (st % 3) * 0.14);
      const stX1 = this.fastCos(streamAngle1) * streamRadius1;
      const stY1 = this.fastSin(streamAngle1) * streamRadius1;
      const stX2 = this.fastCos(streamAngle2) * streamRadius2;
      const stY2 = this.fastSin(streamAngle2) * streamRadius2;

      ctx.beginPath();
      ctx.moveTo(stX1, stY1);
      ctx.lineTo(stX2, stY2);
      ctx.stroke();
    }
    ctx.restore();

    const coreRadius = maxRadius * 0.3;

    const darkCore1 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    darkCore1.addColorStop(
      0,
      this.hsla(darkHue250, 30, 5, 0.95 + audioIntensity * 0.05),
    );
    darkCore1.addColorStop(
      0.5,
      this.hsla(darkHue240, 40, 8, 0.7 + bassIntensity * 0.2),
    );
    darkCore1.addColorStop(1, this.hsla(darkHue230, 50, 12, 0));
    ctx.fillStyle = darkCore1;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    const coreRadius2 = coreRadius * 0.65;
    const darkCore2 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius2);
    darkCore2.addColorStop(0, this.hsla(darkHue260, 25, 3, 0.98));
    darkCore2.addColorStop(0.6, this.hsla(darkHue250, 32, 6, 0.85));
    darkCore2.addColorStop(1, this.hsla(darkHue240, 38, 9, 0.5));
    ctx.fillStyle = darkCore2;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius2, 0, twoPi);
    ctx.fill();

    const coreRadius3 = coreRadius * 0.35;
    const darkCore3 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius3);
    darkCore3.addColorStop(0, this.hsla(darkHue260, 20, 2, 1));
    darkCore3.addColorStop(0.7, this.hsla(darkHue250, 28, 4, 0.95));
    darkCore3.addColorStop(1, this.hsla(darkHue240, 35, 7, 0.8));
    ctx.fillStyle = darkCore3;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius3, 0, twoPi);
    ctx.fill();

    const singularityRadius = coreRadius3 * (0.3 + bassIntensity * 0.2);
    ctx.fillStyle = this.hsla(darkHue260, 15, 1, 1);
    ctx.shadowBlur = useShadows ? (20 + audioIntensity * 15) * shadowScale : 0;
    ctx.shadowColor = this.hsla(darkHue250, 25, 3, 0.95);
    ctx.beginPath();
    ctx.arc(0, 0, singularityRadius, 0, twoPi);
    ctx.fill();

    if (!lowDetail) {
      const gravityWaves = Math.max(4, (12 * detailScale) | 0);
      ctx.strokeStyle = this.hsla(
        darkHue240,
        50,
        25,
        0.2 + trebleIntensity * 0.2,
      );
      ctx.lineWidth = Math.max(0.8, detailScale);
      ctx.setLineDash([4 * detailScale, 9 * detailScale]);

      for (let i = 0; i < gravityWaves; i++) {
        const radius =
          maxRadius * (0.35 + i * 0.06) + this.fastSin(timeGravity + i) * 5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, twoPi);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    if (detailScale >= 0.6) {
      const lensingCount = Math.max(
        2,
        ((6 + ((bassIntensity * 4) | 0)) * detailScale) | 0,
      );
      const lensingHue = this.fastMod360(this.hueBase + 242);
      const lensingAlpha = 0.25 + audioIntensity * 0.2;

      ctx.save();
      ctx.strokeStyle = this.hsla(lensingHue, 55, 30, lensingAlpha);
      ctx.lineWidth = (2 + trebleIntensity * 1.5) * (0.75 + detailScale * 0.25);
      ctx.shadowBlur = useShadows ? 15 * shadowScale : 0;
      ctx.shadowColor = this.hsla(lensingHue, 60, 35, lensingAlpha * 0.7);

      for (let lens = 0; lens < lensingCount; lens++) {
        const lensAngle = this.fastMod360(lens * 60 + this.time * 0.1);
        const lensRadius = maxRadius * (0.42 + (lens % 3) * 0.08);
        const arcStart = this.fastMod360(lensAngle - 25);
        const arcEnd = this.fastMod360(lensAngle + 25);
        const arcStartRad = (arcStart * Math.PI) / 180;
        const arcEndRad = (arcEnd * Math.PI) / 180;

        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, arcStartRad, arcEndRad);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderSoulFragment(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.44;
    const fragments = 9;
    const invFragments = 1 / fragments;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const fragmentAngleStep = twoPi * invFragments;
    const timeFragment = this.time * 0.0008;
    const timeRadius = this.time * 0.002;
    const timeSize = this.time * 0.003;
    const timeAlpha = this.time * 0.004;
    const soulHue140 = this.fastMod360(this.hueBase + 140);
    const soulHue130 = this.fastMod360(this.hueBase + 130);
    const soulHue120 = this.fastMod360(this.hueBase + 120);
    const soulHue150 = this.fastMod360(this.hueBase + 150);

    const spiritCount = 30 + ((midIntensity * 20) | 0);
    const spiritHue = this.fastMod360(this.hueBase + 135);
    const spiritAlpha = 0.25 + audioIntensity * 0.2;
    ctx.fillStyle = this.hsla(spiritHue, 80, 70, spiritAlpha);

    for (let s = 0; s < spiritCount; s++) {
      const spiritOrbit = maxRadius * (0.3 + (s % 5) * 0.06);
      const spiritAngle = this.fastMod360(s * 14.7 + this.time * 0.1);
      const spiritPulse = 1 + this.fastSin(this.time * 0.012 + s * 0.6) * 0.18;
      const spiritX = this.fastCos(spiritAngle) * spiritOrbit * spiritPulse;
      const spiritY = this.fastSin(spiritAngle) * spiritOrbit * spiritPulse;
      const spiritSize = 1.8 + (s % 3) * 0.7 + midIntensity * 1.3;

      ctx.fillRect(
        spiritX - spiritSize * 0.5,
        spiritY - spiritSize * 0.5,
        spiritSize,
        spiritSize,
      );
    }

    for (let frag = 0; frag < fragments; frag++) {
      const angle = fragmentAngleStep * frag + timeFragment;

      const radius = maxRadius * (0.4 + this.fastSin(timeRadius + frag) * 0.15);
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const hue = this.fastMod360(this.hueBase + 120 + frag * 25);
      const size = 25 + this.fastSin(timeSize + frag) * 8 + midIntensity * 10;
      const alpha =
        0.5 + this.fastSin(timeAlpha + frag) * 0.2 + midIntensity * 0.3;

      const trailLength = 5;
      const trailHue = this.fastMod360(hue + 15);
      const trailAlpha = alpha * 0.3;
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.hsla(trailHue, 85, 65, trailAlpha * 0.7);
      ctx.fillStyle = this.hsla(trailHue, 75, 60, trailAlpha);

      for (let t = 1; t <= trailLength; t++) {
        const trailAngle = angle - t * 0.08;
        const trailRadius = radius * (1 - t * 0.02);
        const trailX = this.fastCos(trailAngle) * trailRadius;
        const trailY = this.fastSin(trailAngle) * trailRadius;
        const trailSize = size * (0.8 - t * 0.12);
        const trailFade = 1 - (t / trailLength) * 0.7;

        ctx.globalAlpha = trailAlpha * trailFade;
        ctx.beginPath();
        ctx.arc(trailX, trailY, trailSize, 0, twoPi);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const hue30 = this.fastMod360(hue + 30);
      const hue60 = this.fastMod360(hue + 60);
      const alpha07 = alpha * 0.7;
      const fragmentGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      fragmentGradient.addColorStop(0, this.hsla(hue, 90, 75, alpha));
      fragmentGradient.addColorStop(0.5, this.hsla(hue30, 80, 65, alpha07));
      fragmentGradient.addColorStop(1, this.hsla(hue60, 70, 55, 0));

      ctx.fillStyle = fragmentGradient;
      ctx.shadowBlur = 30 + audioIntensity * 15;
      ctx.shadowColor = this.hsla(hue, 100, 70, 0.7);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, twoPi);
      ctx.fill();

      ctx.strokeStyle = this.hsla(hue, 100, 80, alpha * 0.8);
      ctx.lineWidth = 2 + bassIntensity * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7, 0, twoPi);
      ctx.stroke();

      const shardCount = 4 + ((bassIntensity * 2) | 0);
      const shardOrbitRadius = size * 1.3;
      const shardHue = this.fastMod360(hue + 40);
      const shardAlpha = alpha * 0.6;

      ctx.save();
      ctx.translate(x, y);
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.hsla(shardHue, 90, 70, shardAlpha * 0.8);
      ctx.fillStyle = this.hsla(shardHue, 85, 68, shardAlpha);

      for (let sh = 0; sh < shardCount; sh++) {
        const shardAngle = this.fastMod360(
          sh * (360 / shardCount) + this.time * 0.15 + frag * 30,
        );
        const shardPulse =
          1 + this.fastSin(this.time * 0.02 + sh + frag) * 0.15;
        const shX = this.fastCos(shardAngle) * shardOrbitRadius * shardPulse;
        const shY = this.fastSin(shardAngle) * shardOrbitRadius * shardPulse;
        const shardSize = 3 + bassIntensity * 2.5;

        ctx.beginPath();
        ctx.arc(shX, shY, shardSize, 0, twoPi);
        ctx.fill();
      }

      ctx.restore();
    }

    const coreRadius = maxRadius * 0.2;

    const soulCore1 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    soulCore1.addColorStop(
      0,
      this.hsla(soulHue140, 100, 90, 0.9 + audioIntensity * 0.1),
    );
    soulCore1.addColorStop(
      0.6,
      this.hsla(soulHue130, 95, 75, 0.6 + midIntensity * 0.2),
    );
    soulCore1.addColorStop(1, this.hsla(soulHue120, 90, 60, 0));
    ctx.fillStyle = soulCore1;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    const coreRadius2 = coreRadius * 0.65;
    const soulCore2 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius2);
    soulCore2.addColorStop(0, this.hsla(soulHue150, 100, 88, 0.95));
    soulCore2.addColorStop(0.5, this.hsla(soulHue140, 98, 78, 0.8));
    soulCore2.addColorStop(1, this.hsla(soulHue130, 92, 68, 0.4));
    ctx.fillStyle = soulCore2;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius2, 0, twoPi);
    ctx.fill();

    const coreRadius3 = coreRadius * 0.35;
    const soulCore3 = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius3);
    soulCore3.addColorStop(0, this.hsla(soulHue150, 100, 95, 1));
    soulCore3.addColorStop(0.6, this.hsla(soulHue140, 100, 85, 0.9));
    soulCore3.addColorStop(1, this.hsla(soulHue130, 95, 75, 0.7));
    ctx.fillStyle = soulCore3;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius3, 0, twoPi);
    ctx.fill();

    const heartRadius =
      coreRadius3 *
      (0.45 + midIntensity * 0.25 + this.fastSin(this.time * 0.005) * 0.15);
    ctx.fillStyle = this.hsla(
      soulHue150,
      100,
      98,
      0.95 + audioIntensity * 0.05,
    );
    ctx.shadowBlur = 30 + bassIntensity * 20;
    ctx.shadowColor = this.hsla(soulHue150, 100, 90, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, heartRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderForbiddenRitual(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.43;
    const ritualCircles = 7;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const timeRotation = this.time * 0.0005;
    const ritualHue310 = this.fastMod360(this.hueBase + 310);
    const ritualHue300 = this.fastMod360(this.hueBase + 300);
    const ritualHue290 = this.fastMod360(this.hueBase + 290);
    const ritualHue320 = this.fastMod360(this.hueBase + 320);

    // Firefox optimization: Reduce rune count significantly
    const runeCount = 20 + ((bassIntensity * 15) | 0); // Reduced from 40 + 30
    const runeHue = this.fastMod360(this.hueBase + 305);
    const runeAlpha = 0.3 + trebleIntensity * 0.25;
    ctx.fillStyle = this.hsla(runeHue, 85, 55, runeAlpha);

    // Batch all rune rects (Firefox handles batched rects better)
    for (let r = 0; r < runeCount; r++) {
      const runeRadius = maxRadius * 0.25 + (r % 20) * maxRadius * 0.025;
      const runeAngle = this.fastMod360(r * 17.3 + this.time * 0.08);
      const runePulse = 1 + this.fastSin(this.time * 0.01 + r * 0.5) * 0.15;
      const runeX = this.fastCos(runeAngle) * runeRadius * runePulse;
      const runeY = this.fastSin(runeAngle) * runeRadius * runePulse;
      const runeSize = 1.5 + (r % 3) * 0.8 + bassIntensity * 1.2;

      ctx.fillRect(
        runeX - runeSize * 0.5,
        runeY - runeSize * 0.5,
        runeSize,
        runeSize,
      );
    }

    // Firefox optimization: Only shadow every other circle, skip symbols and pentagrams
    for (let circle = 0; circle < ritualCircles; circle++) {
      const radius = maxRadius * (0.15 + circle * 0.14);
      const rotation = timeRotation * (circle % 2 === 0 ? 1 : -1);

      ctx.save();
      ctx.rotate(rotation);

      const hue = this.fastMod360(this.hueBase + 300 + circle * 12);
      const strokeAlpha = 0.6 + audioIntensity * 0.2;
      ctx.strokeStyle = this.hsla(hue, 85, 40, strokeAlpha);
      ctx.lineWidth =
        2 + (circle === ritualCircles - 1 ? bassIntensity * 2 : 0);

      // Only shadow every other circle (7 → 3-4 shadows)
      if (circle % 2 === 0) {
        ctx.shadowBlur = 12; // Reduced from 20+
        ctx.shadowColor = this.hsla(hue, 100, 45, 0.6); // Reduced alpha
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.stroke();

      // Skip individual symbols entirely (was 8-20 per circle × 7 = up to 140 arcs!)
      // This removes the most expensive part of this pattern

      ctx.restore();

      // Skip pentagrams entirely (removes additional shadowed strokes)
    }

    // Firefox optimization: Batch spikes, reduce shadow, skip flames
    const spikeCount = 8;
    const invSpikeCount = 1 / spikeCount;
    const spikeAngleStep = twoPi * invSpikeCount;
    const spikeHue = this.fastMod360(this.hueBase + 315);
    const spikeAlpha = 0.35 + audioIntensity * 0.35;
    const spikeInner = maxRadius * 0.18;
    const spikeOuter =
      maxRadius * (0.78 + bassIntensity * 0.12 + audioIntensity * 0.08);

    ctx.save();
    ctx.shadowBlur = 15; // Reduced from 28+
    ctx.shadowColor = this.hsla(spikeHue, 100, 55, spikeAlpha * 0.5); // Reduced alpha
    ctx.strokeStyle = this.hsla(spikeHue, 95, 60, spikeAlpha);
    ctx.lineWidth = 2.5 + bassIntensity * 2;
    ctx.lineCap = "round";

    // Batch all spikes into one path
    ctx.beginPath();
    for (let s = 0; s < spikeCount; s++) {
      const a = spikeAngleStep * s + this.time * 0.0012;
      const wobble =
        1 + this.fastSin(this.time * 0.006 + s) * 0.08 + trebleIntensity * 0.06;
      const inner = spikeInner * wobble;
      const outer = spikeOuter * wobble;

      const x1 = this.fastCos(a) * inner;
      const y1 = this.fastSin(a) * inner;
      const x2 = this.fastCos(a) * outer;
      const y2 = this.fastSin(a) * outer;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      // Skip flame particles entirely (removes 24-56 additional arc fills)
    }
    ctx.stroke();
    ctx.restore();

    // Firefox optimization: Reduce wisp count and shadow
    const wispCount = 8 + ((trebleIntensity * 4) | 0); // Reduced from 12-18
    const wispHue = this.fastMod360(this.hueBase + 308);
    const wispAlpha = 0.35 + audioIntensity * 0.25;

    ctx.save();
    ctx.shadowBlur = 10; // Reduced from 18
    ctx.shadowColor = this.hsla(wispHue, 100, 60, wispAlpha * 0.5); // Reduced alpha
    ctx.fillStyle = this.hsla(wispHue, 92, 58, wispAlpha);

    // Use fillRect instead of arc for wisps (faster)
    for (let w = 0; w < wispCount; w++) {
      const wispOrbit = maxRadius * (0.5 + (w % 3) * 0.15);
      const wispAngle = this.fastMod360(
        w * 28 + this.time * 0.12 + this.fastSin(this.time * 0.008 + w) * 25,
      );
      const wispPulse = 1 + this.fastSin(this.time * 0.018 + w * 0.7) * 0.2;
      const wispX = this.fastCos(wispAngle) * wispOrbit * wispPulse;
      const wispY = this.fastSin(wispAngle) * wispOrbit * wispPulse;
      const wispSize = 2.5 + (w % 4) * 0.6 + trebleIntensity * 1.5;

      ctx.fillRect(
        wispX - wispSize,
        wispY - wispSize,
        wispSize * 2,
        wispSize * 2,
      );
    }
    ctx.restore();

    // Firefox optimization: Simplify center to single gradient with reduced shadow
    const centerRadius = maxRadius * 0.15;

    const ritualCenter = ctx.createRadialGradient(0, 0, 0, 0, 0, centerRadius);
    ritualCenter.addColorStop(
      0,
      this.hsla(ritualHue320, 100, 70, 0.95 + audioIntensity * 0.05),
    );
    ritualCenter.addColorStop(
      0.5,
      this.hsla(ritualHue310, 98, 55, 0.85 + bassIntensity * 0.1),
    );
    ritualCenter.addColorStop(1, this.hsla(ritualHue290, 90, 35, 0));

    ctx.fillStyle = ritualCenter;
    ctx.shadowBlur = 15; // Reduced from 25+
    ctx.shadowColor = this.hsla(ritualHue310, 100, 70, 0.7); // Reduced alpha
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderTwilightZone(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.46;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const lowDetail = detailScale < 0.82;
    const useShadows = detailScale >= 0.8;

    const zonesBase = Math.max(4, (6 * detailScale) | 0);
    const zonesExtraRaw =
      audioIntensity > 0.55 ? 2 : audioIntensity > 0.25 ? 1 : 0;
    const zonesExtra = lowDetail ? Math.min(1, zonesExtraRaw) : zonesExtraRaw;
    const zones = zonesBase + zonesExtra;
    const invZones = 1 / zones;

    ctx.globalCompositeOperation = "lighter";

    const riftParticles = Math.max(
      14,
      ((24 + ((midIntensity * 18) | 0)) * detailScale) | 0,
    );
    const invRiftParticles = 1 / riftParticles;
    const timeRiftAngle = this.time * 0.002;
    const timeRiftRad = this.time * 0.005;
    for (let r = 0; r < riftParticles; r++) {
      const rAngle = twoPi * r * invRiftParticles + timeRiftAngle;
      const rZone = r % zones;
      const rRadius =
        maxRadius * invZones * (rZone + 0.55) +
        this.fastSin(timeRiftRad + r) * 14;
      const rx = this.fastCos(rAngle) * rRadius;
      const ry = this.fastSin(rAngle) * rRadius;
      const rAlpha = 0.18 + this.fastSin(this.time * 0.004 + r) * 0.1;
      const rHue =
        (rZone & 1) === 0
          ? this.fastMod360(this.hueBase + 286 + r * 4)
          : this.fastMod360(this.hueBase + 44 + r * 4);

      ctx.fillStyle = this.hsla(rHue, 80, 65, rAlpha);

      ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
    }

    const ringGlow = useShadows ? 10 + midIntensity * 12 : 0;
    ctx.shadowBlur = ringGlow;
    for (let zone = 0; zone < zones; zone++) {
      const innerRadius = maxRadius * invZones * zone;
      const outerRadius = maxRadius * invZones * (zone + 1);
      const midRadius = (innerRadius + outerRadius) * 0.5;
      const rotation = this.time * 0.0006 * ((zone & 1) === 0 ? 1 : -1);

      const hueA = this.fastMod360(this.hueBase + 280 + zone * 12);
      const hueB = this.fastMod360(this.hueBase + 40 + zone * 12);
      const hue = (zone & 1) === 0 ? hueA : hueB;
      const alpha =
        0.18 +
        midIntensity * 0.18 +
        this.fastSin(this.time * 0.003 + zone) * 0.08;

      if (useShadows) {
        ctx.shadowColor = this.hsla(hue, 85, 55, 0.28);
      }
      ctx.strokeStyle = this.hsla(hue, 70, 55, alpha);
      ctx.lineWidth = 6 + bassIntensity * 3;
      ctx.beginPath();
      ctx.arc(0, 0, midRadius, 0, twoPi);
      ctx.stroke();

      const sparkleCount = Math.max(
        2,
        ((4 + ((bassIntensity * 2) | 0)) * detailScale) | 0,
      );
      const invSparkle = 1 / sparkleCount;
      const sparkleAngleBase = this.time * 0.008;
      ctx.fillStyle = this.hsla(hue, 90, 70, alpha * 0.9);
      for (let s = 0; s < sparkleCount; s++) {
        const a = twoPi * s * invSparkle + sparkleAngleBase + rotation;
        const r = outerRadius + this.fastSin(this.time * 0.01 + s + zone) * 2;
        const sx = this.fastCos(a) * r;
        const sy = this.fastSin(a) * r;
        ctx.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4);
      }

      if ((zone & 1) === 0 && audioIntensity > 0.2) {
        const tearCount = lowDetail ? 1 : 2;
        const invTear = 1 / tearCount;
        ctx.strokeStyle = this.hsla(hueB, 85, 62, alpha * 0.9);
        ctx.lineWidth = 1.5 + bassIntensity * 1.2;
        ctx.beginPath();
        for (let tIdx = 0; tIdx < tearCount; tIdx++) {
          const a = twoPi * tIdx * invTear + rotation;
          const tearLength =
            16 +
            bassIntensity * 10 +
            this.fastSin(this.time * 0.006 + tIdx + zone) * 6;
          const x1 = this.fastCos(a) * outerRadius;
          const y1 = this.fastSin(a) * outerRadius;
          const x2 = this.fastCos(a) * (outerRadius + tearLength);
          const y2 = this.fastSin(a) * (outerRadius + tearLength);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    const wispCount = Math.max(
      4,
      ((6 + ((midIntensity * 4) | 0)) * detailScale) | 0,
    );
    const invWisp = 1 / wispCount;
    const timeWisp = this.time * 0.004;
    const wispAlpha = 0.22 + midIntensity * 0.22;
    const evenWispHue = this.fastMod360(this.hueBase + 320);
    const oddWispHue = this.fastMod360(this.hueBase + 50);
    ctx.shadowBlur = useShadows ? 10 + audioIntensity * 10 : 0;
    for (let pass = 0; pass < 2; pass++) {
      const hue = pass === 0 ? evenWispHue : oddWispHue;
      ctx.fillStyle = this.hsla(hue, 85, 65, wispAlpha);
      if (useShadows) {
        ctx.shadowColor = this.hsla(hue, 85, 60, 0.25);
      }
      for (let w = pass; w < wispCount; w += 2) {
        const wAngle = twoPi * w * invWisp + timeWisp;
        const wRadius =
          maxRadius * (0.14 + this.fastSin(this.time * 0.006 + w) * 0.06);
        const wx = this.fastCos(wAngle) * wRadius;
        const wy = this.fastSin(wAngle) * wRadius;
        const wSize =
          4 + midIntensity * 3 + this.fastSin(this.time * 0.008 + w) * 0.8;
        const wDiameter = wSize * 2;
        ctx.fillRect(wx - wSize, wy - wSize, wDiameter, wDiameter);
      }
    }
    ctx.shadowBlur = 0;

    const coreLayers = lowDetail ? 1 : 2;
    for (let layer = 0; layer < coreLayers; layer++) {
      const coreRadius = maxRadius * (0.22 - layer * 0.06);
      const corePulse =
        1 +
        this.fastSin(this.time * 0.005 + layer * 0.4) * 0.08 +
        audioIntensity * 0.06;
      const finalRadius = coreRadius * corePulse;

      const coreHue =
        layer === 0
          ? this.fastMod360(this.hueBase + 320)
          : this.fastMod360(this.hueBase + 50);
      if (lowDetail) {
        ctx.fillStyle = this.hsla(coreHue, 78, 56, 0.5 + audioIntensity * 0.25);
      } else {
        const twilightCore = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          finalRadius,
        );
        twilightCore.addColorStop(
          0,
          this.hsla(coreHue, 80, 62, 0.75 + audioIntensity * 0.2),
        );
        twilightCore.addColorStop(
          0.6,
          this.hsla(
            this.fastMod360(coreHue + 20),
            75,
            52,
            0.35 + midIntensity * 0.25,
          ),
        );
        twilightCore.addColorStop(
          1,
          this.hsla(this.fastMod360(coreHue + 40), 70, 45, 0),
        );
        ctx.fillStyle = twilightCore;
      }
      ctx.beginPath();
      ctx.arc(0, 0, finalRadius, 0, twoPi);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";

    ctx.restore();
  }

  private renderSpectralEcho(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.45;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const lowDetail = detailScale < 0.82;
    const useShadows = detailScale >= 0.82;

    const baseLayers = Math.max(6, (8 * detailScale) | 0);
    const extraLayersRaw =
      trebleIntensity > 0.6 ? 3 : trebleIntensity > 0.3 ? 2 : 0;
    const extraLayers = lowDetail
      ? Math.min(1, extraLayersRaw)
      : extraLayersRaw;
    const echoLayers = baseLayers + extraLayers;

    const stride = lowDetail
      ? audioIntensity < 0.5
        ? 3
        : 2
      : audioIntensity < 0.55
        ? 2
        : 1;
    const phase = stride === 1 ? 0 : ((this.time | 0) >> 5) % stride;

    ctx.globalCompositeOperation = "lighter";

    const fragmentCount = Math.max(
      14,
      ((22 + ((trebleIntensity * 18) | 0)) * detailScale) | 0,
    );
    const invFragmentCount = 1 / fragmentCount;
    const timeFrag = this.time * 0.001;
    const timeFragRad = this.time * 0.005;
    const fragSize = lowDetail ? 1.8 : 2.4;
    const fragHalf = fragSize * 0.5;
    for (let f = 0; f < fragmentCount; f++) {
      const fAngle = twoPi * f * invFragmentCount + timeFrag;
      const fLayer = f % echoLayers;
      const fRadius =
        maxRadius * (0.34 + fLayer * 0.04) + this.fastSin(timeFragRad + f) * 10;
      const fx = this.fastCos(fAngle) * fRadius;
      const fy = this.fastSin(fAngle) * fRadius;
      const fAlpha = 0.16 + this.fastSin(this.time * 0.006 + f) * 0.08;
      const fHue = this.fastMod360(this.hueBase + 155 + f * 4);
      ctx.fillStyle = this.hsla(fHue, 80, 72, fAlpha);
      ctx.fillRect(fx - fragHalf, fy - fragHalf, fragSize, fragSize);
    }

    const ringSegmentsBase = lowDetail ? 16 : 24;
    const ringSegmentsExtra = (trebleIntensity * (lowDetail ? 6 : 10)) | 0;
    const ringSegments = Math.max(
      lowDetail ? 12 : 16,
      ((ringSegmentsBase + ringSegmentsExtra) * detailScale) | 0,
    );
    const invRingSegments = 1 / ringSegments;

    const timeRing1 = this.time * 0.004;
    const timeRing2 = this.time * 0.006;
    const timeRing3 = this.time * 0.005;
    const timeBaseRadius = this.time * 0.003;

    ctx.lineCap = "round";
    ctx.shadowBlur = useShadows ? 8 + trebleIntensity * 8 : 0;

    for (let layer = phase; layer < echoLayers; layer += stride) {
      const delay = layer * 0.12;
      const baseRadius =
        maxRadius * (0.32 + layer * 0.055) +
        this.fastSin(timeBaseRadius - delay) * 7;
      const hue = this.fastMod360(this.hueBase + 160 + layer * 10);
      const alpha = (0.68 - layer * 0.06) * (0.45 + trebleIntensity * 0.45);

      if (useShadows) {
        ctx.shadowColor = this.hsla(hue, 100, 75, alpha * 0.28);
      }
      ctx.strokeStyle = this.hsla(hue, 80, 70, alpha);
      ctx.lineWidth = 1.5 + (layer === 0 ? bassIntensity * 2 : 0);

      ctx.beginPath();
      for (let seg = 0; seg <= ringSegments; seg++) {
        const segAngle = twoPi * seg * invRingSegments;
        const distortion =
          this.fastSin(segAngle * 4 + timeRing1 + layer * 0.22) * 4 +
          this.fastSin(segAngle * 8 + timeRing2 - delay) * 2 +
          this.fastSin(segAngle * 3 + timeRing3) * (trebleIntensity * 6);
        const radius = baseRadius + distortion;
        const x = this.fastCos(segAngle) * radius;
        const y = this.fastSin(segAngle) * radius;
        if (seg === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if ((layer & 1) === 0) {
        const particleSegments = lowDetail ? 4 : 6;
        const invParticleSegments = 1 / particleSegments;
        const timeP = this.time * 0.0006;
        const pSize = 1.8 + trebleIntensity * (lowDetail ? 1.0 : 1.4);
        const pHalf = pSize * 0.5;
        ctx.fillStyle = this.hsla(hue, 90, 80, alpha * 0.6);
        for (let i = 0; i < particleSegments; i++) {
          const a = twoPi * i * invParticleSegments + timeP;
          const pr = baseRadius + this.fastSin(a * 3 + timeRing2) * 4;
          const x = this.fastCos(a) * pr;
          const y = this.fastSin(a) * pr;
          ctx.fillRect(x - pHalf, y - pHalf, pSize, pSize);
        }
      }

      if (layer % (lowDetail ? 6 : 5) === 0 && trebleIntensity > 0.25) {
        const beamCount = lowDetail ? 2 : 4;
        const invBeam = 1 / beamCount;
        const timeBeam = this.time * 0.002;
        if (useShadows) {
          ctx.shadowColor = this.hsla(hue, 100, 75, alpha * 0.2);
        }
        ctx.strokeStyle = this.hsla(hue, 90, 72, alpha * 0.5);
        ctx.lineWidth = 1.2 + bassIntensity * 1.2;
        ctx.beginPath();
        for (let b = 0; b < beamCount; b++) {
          const beamAngle = twoPi * b * invBeam + timeBeam;
          const beamLength =
            18 +
            bassIntensity * 10 +
            this.fastSin(this.time * 0.007 + b + layer) * 8;
          const x1 = this.fastCos(beamAngle) * baseRadius;
          const y1 = this.fastSin(beamAngle) * baseRadius;
          const x2 = this.fastCos(beamAngle) * (baseRadius + beamLength);
          const y2 = this.fastSin(beamAngle) * (baseRadius + beamLength);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    const sources = lowDetail ? 1 : audioIntensity > 0.55 ? 2 : 1;
    for (let source = 0; source < sources; source++) {
      const sourceRadius = maxRadius * (0.2 - source * 0.055);
      const sourcePulse =
        1 +
        this.fastSin(this.time * 0.006 + source * 0.5) * 0.1 +
        audioIntensity * 0.06;
      const finalSourceRadius = sourceRadius * sourcePulse;

      const hue = this.fastMod360(this.hueBase + 170 - source * 6);
      if (lowDetail) {
        ctx.fillStyle = this.hsla(hue, 95, 80, 0.62 + audioIntensity * 0.22);
      } else {
        const echoSource = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          finalSourceRadius,
        );
        echoSource.addColorStop(
          0,
          this.hsla(hue, 100, 90, 0.9 + audioIntensity * 0.05),
        );
        echoSource.addColorStop(
          0.55,
          this.hsla(
            this.fastMod360(hue - 10),
            95,
            75,
            0.55 + trebleIntensity * 0.25,
          ),
        );
        echoSource.addColorStop(
          1,
          this.hsla(this.fastMod360(hue - 20), 90, 60, 0),
        );
        ctx.fillStyle = echoSource;
      }
      ctx.beginPath();
      ctx.arc(0, 0, finalSourceRadius, 0, twoPi);
      ctx.fill();
    }

    const coreSegments = lowDetail ? 3 : 5;
    const invCoreSegments = 1 / coreSegments;
    const segRadius = maxRadius * 0.15;
    const segLength = maxRadius * 0.08;
    const coreHue = this.fastMod360(this.hueBase + 170);
    ctx.strokeStyle = this.hsla(
      coreHue,
      100,
      90,
      0.55 + trebleIntensity * 0.25,
    );
    ctx.lineWidth = 2 + bassIntensity * 1.5;
    ctx.shadowBlur = useShadows ? 8 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(coreHue, 100, 80, 0.3);
    }
    ctx.beginPath();
    for (let seg = 0; seg < coreSegments; seg++) {
      const segAngle = twoPi * seg * invCoreSegments + this.time * 0.003;
      const x1 = this.fastCos(segAngle) * segRadius;
      const y1 = this.fastSin(segAngle) * segRadius;
      const x2 = this.fastCos(segAngle) * (segRadius - segLength);
      const y2 = this.fastSin(segAngle) * (segRadius - segLength);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "source-over";

    ctx.restore();
  }

  private renderVoidWhisper(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.44;

    const voidParticles = 18 + ((midIntensity * 16) | 0);
    const invVoidParticles = 1 / voidParticles;
    const timeParticleAngle = this.time * 0.0015;
    const timeParticleRad = this.time * 0.004;
    for (let p = 0; p < voidParticles; p++) {
      const pAngle = twoPi * p * invVoidParticles + timeParticleAngle;
      const baseRad = maxRadius * (0.12 + (p & 3) * 0.07);
      const pRadius =
        baseRad + this.fastSin(timeParticleRad + p) * maxRadius * 0.18;
      const px = this.fastCos(pAngle) * pRadius;
      const py = this.fastSin(pAngle) * pRadius;
      const pSize = 1.2 + this.fastSin(this.time * 0.006 + p) * 0.8;
      const pAlpha = 0.14 + this.fastSin(this.time * 0.005 + p) * 0.08;
      const pHue = this.fastMod360(this.hueBase + 255 + p * 4);

      ctx.fillStyle = this.hsla(pHue, 55, 32, pAlpha);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, twoPi);
      ctx.fill();
    }

    const wispCount = 6 + ((bassIntensity * 2) | 0);
    const invWispCount = 1 / wispCount;
    const timeWisp = this.time * 0.003;
    const wispHue = this.fastMod360(this.hueBase + 262);
    ctx.shadowBlur = 18 + midIntensity * 18;
    ctx.shadowColor = this.hsla(wispHue, 80, 35, 0.35);
    for (let w = 0; w < wispCount; w++) {
      const wAngle = twoPi * w * invWispCount + timeWisp;
      const wRadius =
        maxRadius * (0.18 + this.fastSin(this.time * 0.005 + w) * 0.06);
      const wx = this.fastCos(wAngle) * wRadius;
      const wy = this.fastSin(wAngle) * wRadius;
      const wSize =
        5 + this.fastSin(this.time * 0.007 + w) * 2 + midIntensity * 3;
      const wAlpha = 0.22 + midIntensity * 0.18;

      ctx.fillStyle = this.hsla(wispHue, 70, 40, wAlpha);
      ctx.beginPath();
      ctx.arc(wx, wy, wSize, 0, twoPi);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const whispersBase = 8;
    const whispersExtra = (audioIntensity * 2) | 0;
    const whispers = whispersBase + whispersExtra;
    const invWhispers = 1 / whispers;
    const angleStep = twoPi * invWhispers;
    const skip = audioIntensity < 0.45 ? 2 : 1;

    const timeWhisper = this.time * 0.00045;
    const timeCurl = this.time * 0.006;
    const tendrilHueBase = this.fastMod360(this.hueBase + 260);
    ctx.lineCap = "round";
    ctx.lineWidth = 2 + bassIntensity * 1.6;
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.hsla(tendrilHueBase, 80, 35, 0.35);

    for (let whisper = 0; whisper < whispers; whisper += skip) {
      const a = angleStep * whisper + timeWhisper;
      const r =
        maxRadius * (0.28 + whisper * (0.42 * invWhispers)) +
        this.fastSin(this.time * 0.004 + whisper) * maxRadius * 0.04;

      const hue = this.fastMod360(tendrilHueBase + whisper * 6);
      const alpha = 0.18 + midIntensity * 0.22;

      const inner = r * 0.25;
      const outer = r;
      const x1 = this.fastCos(a) * inner;
      const y1 = this.fastSin(a) * inner;
      const x2 = this.fastCos(a) * outer;
      const y2 = this.fastSin(a) * outer;

      const curl = (0.22 + this.fastSin(timeCurl + whisper) * 0.12) * r;
      const perp = a + Math.PI * 0.5;
      const cx = (x1 + x2) * 0.5 + this.fastCos(perp) * curl;
      const cy = (y1 + y2) * 0.5 + this.fastSin(perp) * curl;

      ctx.strokeStyle = this.hsla(hue, 65, 38, alpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();

      if ((whisper & 1) === 0) {
        ctx.fillStyle = this.hsla(
          this.fastMod360(hue + 8),
          75,
          45,
          alpha * 0.7,
        );
        ctx.beginPath();
        ctx.arc(x2, y2, 2.2, 0, twoPi);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    const coreRadius = maxRadius * (0.26 + audioIntensity * 0.04);
    const voidCenter = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    voidCenter.addColorStop(
      0,
      this.hsla(
        this.fastMod360(this.hueBase + 270),
        45,
        10,
        0.92 + audioIntensity * 0.06,
      ),
    );
    voidCenter.addColorStop(
      0.55,
      this.hsla(
        this.fastMod360(this.hueBase + 260),
        55,
        14,
        0.55 + midIntensity * 0.25,
      ),
    );
    voidCenter.addColorStop(
      1,
      this.hsla(this.fastMod360(this.hueBase + 250), 65, 20, 0),
    );

    ctx.fillStyle = voidCenter;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderDemonicGate(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const pi = Math.PI;
    const halfPi = Math.PI * 0.5;

    const maxRadius = Math.min(this.width, this.height) * 0.42;
    const gateHeight = maxRadius * 1.2;
    const gateWidth = maxRadius * 0.8;
    const halfGateHeight = gateHeight * 0.5;
    const halfGateWidth = gateWidth * 0.5;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const lowDetail = detailScale < 0.82;
    const useShadows = detailScale >= 0.84;

    ctx.globalCompositeOperation = "lighter";

    const baseVortex = Math.max(12, (20 * detailScale) | 0);
    const extraVortex = (bassIntensity * (lowDetail ? 8 : 14)) | 0;
    const vortexParticles = baseVortex + extraVortex;
    const stride = lowDetail ? 2 : bassIntensity > 0.55 ? 2 : 1;
    const phase = stride === 1 ? 0 : ((this.time | 0) >> 4) % stride;
    const invVortex = 1 / vortexParticles;
    const timeSpiral = this.time * 0.004;
    ctx.shadowBlur = useShadows ? 8 + audioIntensity * 8 : 0;
    if (useShadows) {
      const vortexHue = this.fastMod360(this.hueBase + 8);
      ctx.shadowColor = this.hsla(vortexHue, 100, 55, 0.25);
    }
    for (let v = phase; v < vortexParticles; v += stride) {
      const vProgress = v * invVortex;
      const spiralAngle = vProgress * twoPi * 2.2 + timeSpiral;
      const spiralRadius = gateWidth * 0.33 * (1 - vProgress);
      const vx = this.fastCos(spiralAngle) * spiralRadius;
      const vy = this.fastSin(spiralAngle) * spiralRadius;
      const vAlpha = (0.18 + vProgress * 0.35) * (0.65 + audioIntensity * 0.35);
      const vHue = this.fastMod360(this.hueBase + vProgress * 26);
      ctx.fillStyle = this.hsla(vHue, 100, 58, vAlpha);

      const s = 2 + (1 - vProgress) * 2;
      ctx.fillRect(vx - s, vy - s, s + s, s + s);
    }
    ctx.shadowBlur = 0;

    const pillarHueDark = this.fastMod360(this.hueBase + 350);
    const pillarHueMid = this.fastMod360(this.hueBase + 5);
    const runeHue = this.fastMod360(this.hueBase + 15);
    const runeCount = lowDetail ? 3 : 4;
    const invRuneCount = 1 / runeCount;
    for (let side = 0; side < 2; side++) {
      const pillarX = (side === 0 ? -1 : 1) * (halfGateWidth + 20);
      const pillarWidth = 16;

      if (lowDetail) {
        ctx.fillStyle = this.hsla(pillarHueMid, 82, 28, 0.92);
      } else {
        const pillarGradient = ctx.createLinearGradient(
          pillarX - pillarWidth * 0.5,
          -halfGateHeight,
          pillarX + pillarWidth * 0.5,
          halfGateHeight,
        );
        pillarGradient.addColorStop(0, this.hsla(pillarHueDark, 80, 25, 0.9));
        pillarGradient.addColorStop(0.5, this.hsla(pillarHueMid, 85, 30, 0.95));
        pillarGradient.addColorStop(1, this.hsla(pillarHueDark, 80, 25, 0.9));
        ctx.fillStyle = pillarGradient;
      }
      ctx.fillRect(
        pillarX - pillarWidth * 0.5,
        -halfGateHeight,
        pillarWidth,
        gateHeight,
      );

      for (let r = 0; r < runeCount; r++) {
        const runeY =
          -halfGateHeight + gateHeight * (r + 1) * (invRuneCount * 0.85);
        const runeSize = 5 + this.fastSin(this.time * 0.005 + r + side) * 2;
        const runeAlpha =
          0.45 +
          trebleIntensity * 0.25 +
          this.fastSin(this.time * 0.006 + r) * 0.12;
        ctx.fillStyle = this.hsla(runeHue, 100, 55, runeAlpha);
        if (lowDetail) {
          const rect = Math.max(2.2, runeSize * 0.75);
          ctx.fillRect(pillarX - rect * 0.5, runeY - rect * 0.5, rect, rect);
        } else {
          ctx.beginPath();
          const runeType = r % 2;
          if (runeType === 0) {
            ctx.moveTo(pillarX, runeY - runeSize * 0.55);
            ctx.lineTo(pillarX - runeSize * 0.45, runeY + runeSize * 0.55);
            ctx.lineTo(pillarX + runeSize * 0.45, runeY + runeSize * 0.55);
          } else {
            ctx.moveTo(pillarX, runeY - runeSize * 0.6);
            ctx.lineTo(pillarX - runeSize * 0.4, runeY);
            ctx.lineTo(pillarX, runeY + runeSize * 0.6);
            ctx.lineTo(pillarX + runeSize * 0.4, runeY);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    const gateHue = this.fastMod360(this.hueBase);
    const gatePath = new Path2D();
    gatePath.moveTo(-halfGateWidth, halfGateHeight);
    gatePath.lineTo(-halfGateWidth, -halfGateHeight * 0.3);
    gatePath.quadraticCurveTo(
      -halfGateWidth,
      -halfGateHeight,
      0,
      -halfGateHeight,
    );
    gatePath.quadraticCurveTo(
      halfGateWidth,
      -halfGateHeight,
      halfGateWidth,
      -halfGateHeight * 0.3,
    );
    gatePath.lineTo(halfGateWidth, halfGateHeight);
    gatePath.closePath();

    ctx.fillStyle = this.hsla(gateHue, 100, 35, 0.75 + audioIntensity * 0.25);
    ctx.shadowBlur = useShadows ? 12 + audioIntensity * 10 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(gateHue, 100, 40, 0.6);
    }
    ctx.fill(gatePath);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = this.hsla(gateHue, 100, 50, 0.75 + trebleIntensity * 0.2);
    ctx.lineWidth = 3 + bassIntensity * 2.2;
    ctx.stroke(gatePath);

    const baseEntities = Math.max(3, (5 * detailScale) | 0);
    const extraEntities = (bassIntensity * (lowDetail ? 1 : 2)) | 0;
    const entityCount = baseEntities + extraEntities;
    const invEntities = 1 / entityCount;
    const timeEntity = this.time * 0.002;
    const entityHue = this.fastMod360(this.hueBase + 10);
    const eyeHue = this.fastMod360(this.hueBase + 20);
    const entityVertices = lowDetail ? 4 : 5;

    for (let e = 0; e < entityCount; e++) {
      const eAngle = twoPi * e * invEntities + timeEntity;
      const eRadius =
        gateWidth * (0.23 + this.fastSin(this.time * 0.006 + e) * 0.08);
      const ex = this.fastCos(eAngle) * eRadius;
      const ey = this.fastSin(eAngle) * eRadius;
      const eSize =
        7 + trebleIntensity * 3 + this.fastSin(this.time * 0.008 + e) * 3;
      const eAlpha =
        0.28 +
        audioIntensity * 0.22 +
        this.fastSin(this.time * 0.007 + e) * 0.12;

      ctx.fillStyle = this.hsla(entityHue, 95, 45, eAlpha);
      ctx.beginPath();
      for (let v = 0; v <= entityVertices; v++) {
        const vAngle = (twoPi * v) / entityVertices + this.time * 0.005;
        const distortion =
          1 + this.fastSin(vAngle * 2 + this.time * 0.01 + e) * 0.22;
        const vRadius = eSize * distortion;
        const vx = ex + this.fastCos(vAngle) * vRadius;
        const vy = ey + this.fastSin(vAngle) * vRadius;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = this.hsla(eyeHue, 100, 70, eAlpha * 1.05);
      const eyeS = Math.max(1.2, eSize * 0.13);
      ctx.fillRect(
        ex - eSize * 0.28 - eyeS,
        ey - eSize * 0.22 - eyeS,
        eyeS * 2,
        eyeS * 2,
      );
      ctx.fillRect(
        ex + eSize * 0.28 - eyeS,
        ey - eSize * 0.22 - eyeS,
        eyeS * 2,
        eyeS * 2,
      );
    }

    const tendrilCount = lowDetail ? 6 : 8;
    const halfTendrils = tendrilCount >> 1;
    const invTendrilHalf = 1 / halfTendrils;
    const tendrilHue = this.fastMod360(this.hueBase + 8);
    ctx.strokeStyle = this.hsla(
      tendrilHue,
      95,
      50,
      0.32 + audioIntensity * 0.22,
    );
    ctx.lineWidth = 1.5 + bassIntensity * 1.2;
    ctx.shadowBlur = useShadows ? 7 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(tendrilHue, 100, 55, 0.2);
    }
    ctx.beginPath();
    for (let tIdx = 0; tIdx < tendrilCount; tIdx++) {
      const side = tIdx < halfTendrils ? -1 : 1;
      const tProgress = (tIdx % halfTendrils) * invTendrilHalf;
      const startY = -halfGateHeight + gateHeight * tProgress;
      const startX = side * halfGateWidth;

      const tendrilLength =
        26 + bassIntensity * 16 + this.fastSin(this.time * 0.008 + tIdx) * 10;
      const tendrilAngle =
        side * (halfPi + this.fastSin(this.time * 0.006 + tIdx) * 0.32);
      const endX = startX + this.fastCos(tendrilAngle) * tendrilLength;
      const endY = startY + this.fastSin(tendrilAngle) * tendrilLength;

      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const sigilCount = lowDetail ? 2 : 4;
    const sigilArcRadius = gateWidth * 0.62;
    const invSigils = 1 / Math.max(1, sigilCount - 1);
    for (let s = 0; s < sigilCount; s++) {
      const sigilAngle = -pi + pi * s * invSigils;
      const sx = this.fastCos(sigilAngle) * sigilArcRadius;
      const sy =
        this.fastSin(sigilAngle) * sigilArcRadius - halfGateHeight * 0.5;
      const sigilSize =
        8 + trebleIntensity * 4 + this.fastSin(this.time * 0.007 + s) * 2;
      const sigilAlpha =
        0.45 +
        audioIntensity * 0.2 +
        this.fastSin(this.time * 0.005 + s) * 0.12;

      const rot = this.time * 0.003 + s;
      ctx.fillStyle = this.hsla(gateHue, 100, 58, sigilAlpha);
      ctx.strokeStyle = this.hsla(
        this.fastMod360(gateHue + 10),
        100,
        70,
        sigilAlpha * 0.75,
      );
      ctx.lineWidth = 1.5;

      const pts = 5;
      ctx.beginPath();
      for (let p = 0; p <= pts; p++) {
        const a = (twoPi * p * 2) / pts - halfPi + rot;
        const px = sx + this.fastCos(a) * sigilSize;
        const py = sy + this.fastSin(a) * sigilSize;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      if (!lowDetail) {
        ctx.stroke();
      }
    }

    const coreLayers = lowDetail ? 1 : 3;
    ctx.shadowBlur = useShadows ? 10 + bassIntensity * 8 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(gateHue, 100, 55, 0.28);
    }
    for (let layer = 0; layer < coreLayers; layer++) {
      const coreRadius = maxRadius * (0.19 - layer * 0.05);
      const corePulse =
        1 +
        this.fastSin(this.time * 0.006 + layer * 0.3) * 0.1 +
        bassIntensity * 0.06;
      const finalCoreRadius = coreRadius * corePulse;

      if (lowDetail) {
        ctx.fillStyle = this.hsla(
          this.fastMod360(gateHue + 6),
          100,
          56,
          0.7 + bassIntensity * 0.2,
        );
      } else {
        const gateCore = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          finalCoreRadius,
        );
        gateCore.addColorStop(
          0,
          this.hsla(
            this.fastMod360(gateHue + layer * 3),
            100,
            80 - layer * 10,
            0.9 - layer * 0.18,
          ),
        );
        gateCore.addColorStop(
          0.55,
          this.hsla(
            this.fastMod360(gateHue + 10 + layer * 3),
            100,
            48 - layer * 6,
            0.55 - layer * 0.12,
          ),
        );
        gateCore.addColorStop(
          1,
          this.hsla(this.fastMod360(gateHue + 20 + layer * 3), 100, 35, 0),
        );
        ctx.fillStyle = gateCore;
      }
      ctx.beginPath();
      ctx.arc(0, 0, finalCoreRadius, 0, twoPi);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "source-over";

    ctx.restore();
  }

  private renderCursedRunes(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.43;
    const runeCount = 16;
    const invRuneCount = 1 / runeCount;
    const angleStep = FlowFieldRenderer.TWO_PI * invRuneCount;

    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + 295),
      85,
      35,
      0.18 + bassIntensity * 0.12,
    );
    ctx.lineWidth = 1 + bassIntensity;

    for (let i = 0; i < runeCount; i += 2) {
      const angle1 = angleStep * i + this.time * 0.0005;
      const radius1 =
        maxRadius * (0.5 + this.fastSin(this.time * 0.002 + i) * 0.12);
      const x1 = this.fastCos(angle1) * radius1;
      const y1 = this.fastSin(angle1) * radius1;

      const oppositeIdx = (i + runeCount / 2) % runeCount;
      const angle2 = angleStep * oppositeIdx + this.time * 0.0005;
      const radius2 =
        maxRadius *
        (0.5 + this.fastSin(this.time * 0.002 + oppositeIdx) * 0.12);
      const x2 = this.fastCos(angle2) * radius2;
      const y2 = this.fastSin(angle2) * radius2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const fragmentCount = 24 + ((midIntensity * 18) | 0);
    for (let f = 0; f < fragmentCount; f++) {
      const fragmentAngle =
        this.fastSin(this.time * 0.001 + f * 0.45) * FlowFieldRenderer.TWO_PI;
      const fragmentRadius =
        maxRadius * 0.2 +
        this.fastSin(this.time * 0.003 + f) * maxRadius * 0.32;
      const fx = this.fastCos(fragmentAngle) * fragmentRadius;
      const fy = this.fastSin(fragmentAngle) * fragmentRadius;
      const fSize = 1.8 + this.fastSin(this.time * 0.005 + f) * 1.3;
      const fAlpha = 0.28 + this.fastSin(this.time * 0.004 + f) * 0.18;
      const fHue = this.fastMod360(this.hueBase + 285 + f * 4);

      ctx.fillStyle = this.hsla(fHue, 95, 45, fAlpha);
      ctx.beginPath();
      ctx.arc(fx, fy, fSize, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();
    }

    for (let i = 0; i < runeCount; i++) {
      const angle = angleStep * i + this.time * 0.0005;
      const radius =
        maxRadius * (0.5 + this.fastSin(this.time * 0.002 + i) * 0.15);
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const hue = this.fastMod360(this.hueBase + 290 + i * 3);
      const size =
        12 + this.fastSin(this.time * 0.003 + i) * 4 + midIntensity * 5;
      const alpha =
        0.6 + this.fastSin(this.time * 0.004 + i) * 0.2 + midIntensity * 0.2;

      const auraRadius =
        size *
        (1.7 + this.fastSin(this.time * 0.006 + i) * 0.4 + bassIntensity * 0.6);
      const auraGradient = ctx.createRadialGradient(
        x,
        y,
        size * 0.4,
        x,
        y,
        auraRadius,
      );
      auraGradient.addColorStop(0, this.hsla(hue, 100, 50, alpha * 0.28));
      auraGradient.addColorStop(0.6, this.hsla(hue, 95, 45, alpha * 0.14));
      auraGradient.addColorStop(1, this.hsla(hue, 90, 40, 0));

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(x, y, auraRadius, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();

      const sparkCount = 5;
      const sparkAngleStep = FlowFieldRenderer.TWO_PI / sparkCount;
      for (let s = 0; s < sparkCount; s++) {
        const sparkAngle = sparkAngleStep * s + this.time * 0.01 + i * 0.2;
        const sparkDist =
          size * (1.2 + this.fastSin(this.time * 0.02 + i + s) * 0.4);
        const sx = x + this.fastCos(sparkAngle) * sparkDist;
        const sy = y + this.fastSin(sparkAngle) * sparkDist;

        ctx.fillStyle = this.hsla(
          this.fastMod360(hue + 12),
          100,
          62,
          alpha * 0.65,
        );
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4, 0, FlowFieldRenderer.TWO_PI);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + this.time * 0.001);

      ctx.strokeStyle = this.hsla(hue, 90, 40, alpha);
      ctx.fillStyle = this.hsla(hue, 85, 35, alpha * 0.45);
      ctx.lineWidth = 2 + bassIntensity * 1.3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.hsla(hue, 100, 45, 0.78);

      const runeType = i % 8;
      if (runeType === 0) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.5, size * 0.7);
        ctx.lineTo(size * 0.5, size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(-size * 0.18, size * 0.2);
        ctx.lineTo(size * 0.18, size * 0.2);
        ctx.closePath();
        ctx.stroke();
      } else if (runeType === 1) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size * 0.7);
        ctx.moveTo(-size * 0.3, -size * 0.3);
        ctx.lineTo(size * 0.3, -size * 0.3);
        ctx.moveTo(-size * 0.25, size * 0.3);
        ctx.lineTo(size * 0.25, size * 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -size * 0.7, size * 0.25, 0, FlowFieldRenderer.TWO_PI);
        ctx.stroke();
      } else if (runeType === 2) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(size * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(0, size * 0.5);
        ctx.moveTo(-size * 0.3, 0);
        ctx.lineTo(size * 0.3, 0);
        ctx.stroke();
      } else if (runeType === 3) {
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.8);
        ctx.lineTo(size * 0.5, -size * 0.8);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.8);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.moveTo(size * 0.5, -size * 0.8);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.stroke();
      } else if (runeType === 4) {
        const hexPoints = 6;
        ctx.beginPath();
        for (let h = 0; h <= hexPoints; h++) {
          const hexAngle = (FlowFieldRenderer.TWO_PI * h) / hexPoints;
          const hx = this.fastCos(hexAngle) * size;
          const hy = this.fastSin(hexAngle) * size;
          if (h === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        for (let h = 0; h < 3; h++) {
          const h1 = (FlowFieldRenderer.TWO_PI * h) / hexPoints;
          const h2 = (FlowFieldRenderer.TWO_PI * (h + 3)) / hexPoints;
          ctx.beginPath();
          ctx.moveTo(this.fastCos(h1) * size, this.fastSin(h1) * size);
          ctx.lineTo(this.fastCos(h2) * size, this.fastSin(h2) * size);
          ctx.stroke();
        }
      } else if (runeType === 5) {
        const starPoints = 7;
        ctx.beginPath();
        for (let sp = 0; sp <= starPoints * 2; sp++) {
          const starAngle = (FlowFieldRenderer.TWO_PI * sp) / (starPoints * 2);
          const starRadius = sp % 2 === 0 ? size : size * 0.45;
          const spx = this.fastCos(starAngle) * starRadius;
          const spy = this.fastSin(starAngle) * starRadius;
          if (sp === 0) ctx.moveTo(spx, spy);
          else ctx.lineTo(spx, spy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (runeType === 6) {
        ctx.beginPath();
        const spiralSegments = 18;
        for (let seg = 0; seg <= spiralSegments; seg++) {
          const t = seg / spiralSegments;
          const spiralAngle = t * FlowFieldRenderer.TWO_PI * 1.4;
          const spiralRadius = size * t;
          const spiralX = this.fastCos(spiralAngle) * spiralRadius;
          const spiralY = this.fastSin(spiralAngle) * spiralRadius;
          if (seg === 0) ctx.moveTo(spiralX, spiralY);
          else ctx.lineTo(spiralX, spiralY);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, FlowFieldRenderer.TWO_PI);
        ctx.stroke();
      } else {
        const pentaPoints = 5;
        ctx.beginPath();
        for (let p = 0; p <= pentaPoints; p++) {
          const pentaAngle =
            (FlowFieldRenderer.TWO_PI * p * 2) / pentaPoints - Math.PI * 0.5;
          const px = this.fastCos(pentaAngle) * size;
          const py = this.fastSin(pentaAngle) * size;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    for (let layer = 0; layer < 4; layer++) {
      const layerRadius = maxRadius * (0.22 - layer * 0.04);
      const layerPulse =
        1 + this.fastSin(this.time * 0.005 + layer * 0.5) * 0.1;
      const finalRadius = layerRadius * layerPulse;

      const cursedCenter = ctx.createRadialGradient(0, 0, 0, 0, 0, finalRadius);
      cursedCenter.addColorStop(
        0,
        this.hsla(
          this.fastMod360(this.hueBase + 300 - layer * 3),
          100,
          50,
          0.9 - layer * 0.15 + audioIntensity * 0.1,
        ),
      );
      cursedCenter.addColorStop(
        0.5,
        this.hsla(
          this.fastMod360(this.hueBase + 290 - layer * 3),
          95,
          40,
          0.7 - layer * 0.1 + bassIntensity * 0.2,
        ),
      );
      cursedCenter.addColorStop(
        1,
        this.hsla(this.fastMod360(this.hueBase + 280 - layer * 3), 90, 30, 0),
      );

      ctx.fillStyle = cursedCenter;
      ctx.beginPath();
      ctx.arc(0, 0, finalRadius, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderShadowDance(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const halfPi = Math.PI * 0.5;
    const maxRadius = Math.min(this.width, this.height) * 0.46;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const lowDetail = detailScale < 0.82;
    const useShadows = detailScale >= 0.84;

    const dancersBase = Math.max(6, (8 * detailScale) | 0);
    const dancersExtraRaw = audioIntensity > 0.55 ? 2 : 0;
    const dancersExtra = lowDetail
      ? Math.min(1, dancersExtraRaw)
      : dancersExtraRaw;
    const dancers = dancersBase + dancersExtra;
    const invDancers = 1 / dancers;
    const angleStep = twoPi * invDancers;

    ctx.globalCompositeOperation = "lighter";

    const dancerX = new Array<number>(dancers);
    const dancerY = new Array<number>(dancers);
    const dancerAngle = new Array<number>(dancers);
    const dancerBaseAngle = new Array<number>(dancers);
    for (let i = 0; i < dancers; i++) {
      const baseAngle = angleStep * i;
      const angle = baseAngle + this.fastSin(this.time * 0.003 + i) * 0.45;
      const radius =
        maxRadius * (0.32 + this.fastSin(this.time * 0.004 + i * 0.5) * 0.18);
      dancerBaseAngle[i] = baseAngle;
      dancerAngle[i] = angle;
      dancerX[i] = this.fastCos(angle) * radius;
      dancerY[i] = this.fastSin(angle) * radius;
    }

    const netHue = this.fastMod360(this.hueBase + 260);
    ctx.strokeStyle = this.hsla(netHue, 65, 20, 0.12 + bassIntensity * 0.12);
    ctx.lineWidth = 1.2 + bassIntensity * 1.6;
    ctx.shadowBlur = useShadows ? 8 + bassIntensity * 6 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(netHue, 70, 25, 0.3);
    }
    ctx.beginPath();
    for (let i = 0; i < dancers; i++) {
      const x1 = dancerX[i] ?? 0;
      const y1 = dancerY[i] ?? 0;
      const angle1 = dancerAngle[i] ?? 0;

      const nextIdx = (i + 1) % dancers;
      const x2 = dancerX[nextIdx] ?? 0;
      const y2 = dancerY[nextIdx] ?? 0;

      const midX = (x1 + x2) * 0.5;
      const midY = (y1 + y2) * 0.5;
      const curveDist = this.fastSin(this.time * 0.006 + i) * 22;
      const perpAngle = angle1 + halfPi;
      const ctrlX = midX + this.fastCos(perpAngle) * curveDist;
      const ctrlY = midY + this.fastSin(perpAngle) * curveDist;

      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(ctrlX, ctrlY, x2, y2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const vertices = lowDetail ? 6 : 8;
    const invVertices = 1 / vertices;
    const trailSteps = lowDetail ? 1 : 2;
    const timeW = this.time * 0.01;

    for (let dancer = 0; dancer < dancers; dancer++) {
      const baseAngle = dancerBaseAngle[dancer] ?? 0;
      const angle = dancerAngle[dancer] ?? 0;
      const x = dancerX[dancer] ?? 0;
      const y = dancerY[dancer] ?? 0;

      const hue = this.fastMod360(this.hueBase + 250 + dancer * 10);
      const size =
        16 + trebleIntensity * 7 + this.fastSin(this.time * 0.005 + dancer) * 6;
      const alpha =
        0.28 +
        trebleIntensity * 0.28 +
        this.fastSin(this.time * 0.004 + dancer) * 0.12;

      ctx.shadowBlur = useShadows ? 10 + bassIntensity * 8 : 0;
      if (useShadows) {
        ctx.shadowColor = this.hsla(hue, 80, 25, 0.35);
      }

      for (let t = 1; t <= trailSteps; t++) {
        const off = t * 0.085;
        const tx =
          this.fastCos(
            baseAngle + this.fastSin(this.time * 0.003 + dancer - off) * 0.45,
          ) *
          (maxRadius *
            (0.32 +
              this.fastSin(this.time * 0.004 + dancer * 0.5 - off) * 0.18));
        const ty =
          this.fastSin(
            baseAngle + this.fastSin(this.time * 0.003 + dancer - off) * 0.45,
          ) *
          (maxRadius *
            (0.32 +
              this.fastSin(this.time * 0.004 + dancer * 0.5 - off) * 0.18));
        const ta = alpha * (0.52 - t * 0.17);
        const trailSize = size * (0.72 - t * 0.12);
        const trailDiameter = trailSize * 2;
        ctx.fillStyle = this.hsla(hue, 70, 28, ta);
        ctx.fillRect(
          tx - trailSize,
          ty - trailSize,
          trailDiameter,
          trailDiameter,
        );
      }

      ctx.fillStyle = this.hsla(hue, 70, 30, alpha);
      ctx.beginPath();
      for (let v = 0; v <= vertices; v++) {
        const vAngle = twoPi * v * invVertices;
        const isOuter = (v & 1) === 0;
        const morph =
          1 + this.fastSin(vAngle * 3 + this.time * 0.008 + dancer) * 0.22;
        const vRadius = (isOuter ? size : size * 0.55) * morph;
        const vx = x + this.fastCos(vAngle + angle) * vRadius;
        const vy = y + this.fastSin(vAngle + angle) * vRadius;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();

      if (!lowDetail || (dancer & 1) === 0) {
        ctx.strokeStyle = this.hsla(hue, 80, 40, alpha * 0.7);
        ctx.lineWidth = 1.5 + bassIntensity * 1.2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.55, 0, twoPi);
        ctx.stroke();
      }

      const wispCount = Math.max(
        1,
        2 + ((bassIntensity * (lowDetail ? 1 : 2)) | 0),
      );
      const invWisp = 1 / wispCount;
      ctx.strokeStyle = this.hsla(hue, 70, 35, alpha * 0.55);
      ctx.lineWidth = 1.4 + bassIntensity * 0.9;
      ctx.beginPath();
      for (let w = 0; w < wispCount; w++) {
        const wa = twoPi * w * invWisp + angle;
        const wl =
          10 + trebleIntensity * 10 + this.fastSin(timeW + dancer + w) * 6;
        const ex = x + this.fastCos(wa) * wl;
        const ey = y + this.fastSin(wa) * wl;
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const centerRadius = maxRadius * (0.2 + audioIntensity * 0.05);
    const centerHue = this.fastMod360(this.hueBase + 255);
    if (lowDetail) {
      ctx.fillStyle = this.hsla(
        centerHue,
        66,
        18,
        0.62 + audioIntensity * 0.25,
      );
    } else {
      const danceCenter = ctx.createRadialGradient(0, 0, 0, 0, 0, centerRadius);
      danceCenter.addColorStop(
        0,
        this.hsla(centerHue, 60, 16, 0.75 + audioIntensity * 0.2),
      );
      danceCenter.addColorStop(
        0.6,
        this.hsla(
          this.fastMod360(centerHue - 10),
          70,
          20,
          0.35 + trebleIntensity * 0.25,
        ),
      );
      danceCenter.addColorStop(
        1,
        this.hsla(this.fastMod360(centerHue - 20), 80, 25, 0),
      );
      ctx.fillStyle = danceCenter;
    }
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, twoPi);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";

    ctx.restore();
  }

  private renderNightmareFuel(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.5;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const nightmares = 6; // Firefox: Reduced from 8-11
    const angleStep = twoPi / nightmares;

    ctx.globalCompositeOperation = "lighter";
    const tentacleCount = 6; // Firefox: Reduced from 10-13
    const tentacleAngleStep = twoPi / tentacleCount;

    // Firefox: NO shadows, NO gradients on tentacles
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3 + bassIntensity * 2;
    ctx.lineCap = "round";

    for (let i = 0; i < tentacleCount; i++) {
      const baseAngle = tentacleAngleStep * i;
      const tentacleLength =
        maxRadius * (0.7 + this.fastSin(this.time * 0.004 + i) * 0.2);
      const segments = 8;
      const invSegments = 1 / segments;
      const segmentLength = tentacleLength * invSegments;

      const tentacleHue = this.fastMod360(this.hueBase + 15 + i * 18);
      ctx.strokeStyle = this.hsla(tentacleHue, 100, 50, 0.7);

      ctx.beginPath();
      ctx.moveTo(0, 0);

      let currentX = 0;
      let currentY = 0;
      let currentAngle = baseAngle + this.time * 0.002 * (i % 2 === 0 ? 1 : -1);

      for (let seg = 0; seg < segments; seg++) {
        const chaos1 = this.fastSin(this.time * 0.008 + i + seg * 0.3) * 0.4;
        const chaos2 =
          this.fastCos(this.time * 0.012 + i * 0.5 + seg * 0.2) * 0.3;
        const audioDistortion = (audioIntensity - 0.5) * 0.5;
        currentAngle += chaos1 + chaos2 + audioDistortion;

        currentX += this.fastCos(currentAngle) * segmentLength;
        currentY += this.fastSin(currentAngle) * segmentLength;
        ctx.lineTo(currentX, currentY);
      }

      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";

    let rng = (this.time * 1103515245 + 12345) | 0;
    const timeAngle = this.time * 0.0009;

    for (let i = 0; i < nightmares; i++) {
      const angle = angleStep * i + timeAngle;
      const orbitRadius = maxRadius * (0.25 + (i % 4) * 0.12);

      rng = (rng * 1664525 + 1013904223) | 0;
      const r1 = ((rng >>> 8) & 0xffff) / 0xffff;
      rng = (rng * 1664525 + 1013904223) | 0;
      const r2 = ((rng >>> 8) & 0xffff) / 0xffff;
      const glitchX = (r1 - 0.5) * 5 * bassIntensity;
      const glitchY = (r2 - 0.5) * 5 * bassIntensity;

      const x = this.fastCos(angle) * orbitRadius + glitchX;
      const y = this.fastSin(angle) * orbitRadius + glitchY;

      const hue = this.fastMod360(this.hueBase + 20 + i * 22);
      const size =
        18 + this.fastSin(this.time * 0.005 + i) * 7 + midIntensity * 8;
      const pulseAlpha =
        0.6 + this.fastSin(this.time * 0.004 + i) * 0.3 + audioIntensity * 0.3;

      const morphVertices = 7;
      const morphAngleStep = twoPi / morphVertices;

      ctx.beginPath();
      for (let v = 0; v <= morphVertices; v++) {
        const vAngle = morphAngleStep * v + this.time * 0.003;
        const distortion =
          1 + this.fastSin(vAngle * 3 + this.time * 0.01) * 0.3 * midIntensity;
        const vRadius = size * distortion;
        const vx = x + this.fastCos(vAngle) * vRadius;
        const vy = y + this.fastSin(vAngle) * vRadius;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();

      // Firefox: Simple fill, no gradient
      ctx.fillStyle = this.hsla(hue, 100, 50, pulseAlpha);
      ctx.shadowBlur = 8; // Reduced from 35-55
      ctx.shadowColor = this.hsla(hue, 100, 45, 0.5);
      ctx.fill();

      // Firefox: Fewer spikes (4 instead of 6-8)
      const spikes = 4;
      const spikeAngleStep = twoPi / spikes;

      ctx.strokeStyle = this.hsla(hue, 100, 60, pulseAlpha * 0.9);
      ctx.lineWidth = 2.5 + bassIntensity * 2;

      ctx.beginPath();
      for (let spike = 0; spike < spikes; spike++) {
        const spikeAngle = spikeAngleStep * spike + this.time * 0.003;
        const spikeLength =
          size * (1.2 + this.fastSin(this.time * 0.006 + spike) * 0.4);
        const spikeX = x + this.fastCos(spikeAngle) * spikeLength;
        const spikeY = y + this.fastSin(spikeAngle) * spikeLength;

        ctx.moveTo(x, y);
        ctx.lineTo(spikeX, spikeY);
      }
      ctx.stroke();
    }

    // Firefox: Simple center, no gradient, minimal shadow
    const coreRadius = maxRadius * 0.3;
    const coreDistortion =
      1 + this.fastSin(this.time * 0.005) * 0.15 * audioIntensity;

    ctx.fillStyle = this.hsla(this.hueBase + 30, 100, 55, 0.95);
    ctx.shadowBlur = 15; // Reduced from 60-100
    ctx.shadowColor = this.hsla(this.hueBase + 30, 100, 55, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * coreDistortion, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderAbyssalDepth(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.5;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const lowDetail = detailScale < 0.82;
    const useShadows = detailScale >= 0.84;
    const depthLayers = Math.max(8, (15 * detailScale) | 0);
    const invDepthLayers = 1 / depthLayers;

    for (let layer = 0; layer < depthLayers; layer++) {
      const radius = maxRadius * (1 - layer * invDepthLayers);
      const hue = this.fastMod360(this.hueBase + 220 - layer * 3);
      const lightness = 8 + layer * 2;
      const alpha = (0.92 - layer * 0.06) * (0.5 + trebleIntensity * 0.5);

      if (lowDetail) {
        ctx.fillStyle = this.hsla(hue, 72, lightness + 2, alpha * 0.75);
      } else {
        const layerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        layerGradient.addColorStop(0, this.hsla(hue, 65, lightness + 6, alpha));
        layerGradient.addColorStop(
          0.6,
          this.hsla(hue, 78, lightness + 1, alpha * 0.72),
        );
        layerGradient.addColorStop(
          1,
          this.hsla(hue - 10, 85, lightness - 2, 0),
        );
        ctx.fillStyle = layerGradient;
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "lighter";
    const creatureCount = Math.max(
      6,
      ((10 + ((trebleIntensity * 3) | 0)) * detailScale) | 0,
    );
    const creatureAngleStep = twoPi / creatureCount;
    ctx.shadowBlur = useShadows ? 14 + bassIntensity * 10 : 0;

    for (let i = 0; i < creatureCount; i++) {
      const angle =
        creatureAngleStep * i + this.time * 0.0006 * (i % 2 === 0 ? 1 : -1);
      const depth = 0.25 + this.fastSin(this.time * 0.003 + i * 0.5) * 0.2;
      const radius = maxRadius * depth;
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      const size =
        6 + this.fastSin(this.time * 0.005 + i) * 3 + trebleIntensity * 4;
      const pulseAlpha =
        0.5 + this.fastSin(this.time * 0.006 + i) * 0.3 + audioIntensity * 0.2;
      const creatureHue = this.fastMod360(this.hueBase + 200 + i * 15);

      if (!lowDetail) {
        const glowSize = size * 2.2;
        ctx.fillStyle = this.hsla(creatureHue, 95, 45, pulseAlpha * 0.38);
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, twoPi);
        ctx.fill();
      }

      ctx.fillStyle = this.hsla(creatureHue, 100, 70, pulseAlpha);
      if (useShadows) {
        ctx.shadowColor = this.hsla(creatureHue, 100, 60, 0.6);
      }
      ctx.beginPath();
      ctx.arc(x, y, size, 0, twoPi);
      ctx.fill();

      const trailCount = lowDetail ? 2 : 3;
      for (let trail = 1; trail <= trailCount; trail++) {
        const trailAngle = angle - trail * 0.1;
        const trailRadius = radius * (1 - trail * 0.03);
        const trailX = this.fastCos(trailAngle) * trailRadius;
        const trailY = this.fastSin(trailAngle) * trailRadius;
        const trailSize = size * (1 - trail * 0.25);
        const trailAlpha = pulseAlpha * (1 - trail * 0.3);

        ctx.fillStyle = this.hsla(creatureHue, 90, 50, trailAlpha * 0.36);
        if (lowDetail) {
          const d = trailSize * 2;
          ctx.fillRect(trailX - trailSize, trailY - trailSize, d, d);
        } else {
          ctx.beginPath();
          ctx.arc(trailX, trailY, trailSize, 0, twoPi);
          ctx.fill();
        }
      }
    }
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "source-over";

    const coreRadius = maxRadius * (0.35 + bassIntensity * 0.1);
    const corePulse = 1 + this.fastSin(this.time * 0.002) * 0.1;
    const finalCoreRadius = coreRadius * corePulse;
    if (lowDetail) {
      ctx.fillStyle = this.hsla(
        this.fastMod360(this.hueBase + 236),
        70,
        8,
        0.92 + audioIntensity * 0.06,
      );
    } else {
      const abyssalCore = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        finalCoreRadius,
      );
      abyssalCore.addColorStop(
        0,
        this.hsla(this.hueBase + 240, 55, 3, 0.98 + audioIntensity * 0.05),
      );
      abyssalCore.addColorStop(
        0.4,
        this.hsla(this.hueBase + 235, 65, 6, 0.85 + bassIntensity * 0.15),
      );
      abyssalCore.addColorStop(
        0.7,
        this.hsla(this.hueBase + 230, 70, 10, 0.6 + trebleIntensity * 0.2),
      );
      abyssalCore.addColorStop(1, this.hsla(this.hueBase + 220, 75, 15, 0));
      ctx.fillStyle = abyssalCore;
    }
    ctx.shadowBlur = useShadows ? 24 + bassIntensity * 16 : 0;
    if (useShadows) {
      ctx.shadowColor = this.hsla(this.hueBase + 240, 80, 10, 0.5);
    }
    ctx.beginPath();
    ctx.arc(0, 0, finalCoreRadius, 0, twoPi);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  private renderPhantomPulse(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.48;

    // Firefox: Reduced wisps, NO gradients
    ctx.globalCompositeOperation = "lighter";
    const wispCount = 6; // Reduced from 8-10
    const wispAngleStep = FlowFieldRenderer.TWO_PI / wispCount;
    const timeWispAngle = this.time * 0.002;
    const timeWispLen = this.time * 0.003;

    ctx.lineWidth = 2 + bassIntensity * 2.5;
    ctx.lineCap = "round";
    ctx.shadowBlur = 0; // No shadows

    for (let i = 0; i < wispCount; i++) {
      const wispAngle = wispAngleStep * i + timeWispAngle;
      const lenBase = maxRadius * (0.5 + this.fastSin(timeWispLen + i) * 0.25);

      const endX = this.fastCos(wispAngle) * lenBase;
      const endY = this.fastSin(wispAngle) * lenBase;

      const wispHue = this.fastMod360(this.hueBase + 100 + i * 18);
      const headAlpha = 0.7 + audioIntensity * 0.2;

      ctx.strokeStyle = this.hsla(wispHue, 100, 75, headAlpha);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";

    // Firefox: Fewer pulse waves, minimal shadows
    const pulseWaves = 5; // Reduced from 6-8
    const timePulse = this.time * 0.004;
    const twoPi = FlowFieldRenderer.TWO_PI;

    ctx.shadowBlur = 8; // Reduced from 26-44

    for (let wave = 0; wave < pulseWaves; wave++) {
      const delay = wave * 0.16;
      const radius =
        maxRadius * (0.18 + wave * 0.1) +
        this.fastSin(timePulse - delay) * maxRadius * 0.05;
      const hue = this.fastMod360(this.hueBase + 100 + wave * 14);
      const alpha = (0.8 - wave * 0.08) * (0.5 + midIntensity * 0.5);

      ctx.strokeStyle = this.hsla(hue, 90, 70, alpha);
      ctx.lineWidth = 2.5 + (wave === 0 ? bassIntensity * 4 : 0);
      ctx.shadowColor = this.hsla(hue, 100, 75, alpha * 0.5);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, twoPi);
      ctx.stroke();

      // Skip node arcs entirely (removes 18-24 additional arc fills)
    }

    // Firefox: Simple center, no gradient
    const coreRadius = maxRadius * 0.25;
    ctx.fillStyle = this.hsla(this.hueBase + 110, 100, 85, 0.95);
    ctx.shadowBlur = 12; // Reduced from 44-70
    ctx.shadowColor = this.hsla(this.hueBase + 110, 100, 80, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  private renderInfernalFlame(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const maxRadius = Math.min(this.width, this.height) * 0.52;

    // Firefox: Single layer, fewer flames, NO shadows
    const flames = 8; // Reduced from 10-13, single layer instead of 2
    const angleStep = FlowFieldRenderer.TWO_PI / flames;

    const flamePoints = 6; // Reduced from 8
    const invFlamePoints = 1 / flamePoints;

    const timeFlameAngle = this.time * 0.0015;
    const timeFlameRadius = this.time * 0.012;
    const timeWave1 = this.time * 0.02;
    const timeWave2 = this.time * 0.04;

    const maxRadius018 = maxRadius * 0.18;
    const wave1Amp = 30;
    const wave2Amp = 8;
    const waveAudioScale = 1 + audioIntensity * 0.5;

    ctx.shadowBlur = 0; // NO shadows

    for (let flame = 0; flame < flames; flame++) {
      const baseAngle = angleStep * flame + timeFlameAngle;
      const baseRadius = maxRadius * (0.12 + flame * 0.075);
      const radius =
        baseRadius + this.fastSin(timeFlameRadius + flame) * maxRadius018;

      const hueBase = this.fastMod360(this.hueBase + flame * 12);

      const cosBase = this.fastCos(baseAngle);
      const sinBase = this.fastSin(baseAngle);

      const flameAlpha = 0.8 + audioIntensity * 0.15;
      ctx.fillStyle = this.hsla(hueBase, 100, 70, flameAlpha);

      ctx.beginPath();
      for (let i = 0; i <= flamePoints; i++) {
        const t = i * invFlamePoints;
        const currentRadius = baseRadius + (radius - baseRadius) * t;

        const baseT = t * Math.PI;
        const wave1 = this.fastSin(baseT * 4 + timeWave1 + flame) * wave1Amp;
        const wave2 = this.fastSin(baseT * 9 + timeWave2) * wave2Amp;
        const totalWave = (wave1 + wave2) * waveAudioScale;
        const angle = baseAngle + totalWave * 0.012;
        const x = this.fastCos(angle) * currentRadius;
        const y = this.fastSin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(cosBase * baseRadius, sinBase * baseRadius);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalCompositeOperation = "lighter";
    const emberCount = 16 + ((bassIntensity * 8) | 0); // Reduced from 16 + 16
    const maxEmberRadius = maxRadius * 1.1;

    let rng = (this.time * 1103515245 + 12345) | 0;
    const twoPi = FlowFieldRenderer.TWO_PI;

    for (let i = 0; i < emberCount; i++) {
      const emberAngle = (this.time * 0.0025 + i * 0.5) % twoPi;
      const emberDist = (this.time * 1.6 + i * 9) % maxEmberRadius;
      const swirlX = this.fastSin(this.time * 0.01 + i) * 16;
      const swirlY = this.fastCos(this.time * 0.014 + i) * 16;
      const baseX = this.fastCos(emberAngle) * emberDist + swirlX;
      const baseY = this.fastSin(emberAngle) * emberDist + swirlY;

      rng = (rng * 1664525 + 1013904223) | 0;
      const randNorm = (rng & 0xffff) / 0xffff;
      const emberSize = 1.5 + randNorm * 2 + trebleIntensity * 1.5;
      const emberHue = this.fastMod360(this.hueBase + 10 + randNorm * 50);
      const emberAlpha =
        (1 - emberDist / maxEmberRadius) * (0.55 + audioIntensity * 0.35);

      ctx.fillStyle = this.hsla(emberHue, 100, 80, emberAlpha);

      const halfSize = emberSize * 0.5;
      ctx.fillRect(baseX - halfSize, baseY - halfSize, emberSize, emberSize);
    }

    // Firefox: Simple center, no gradient, minimal shadow
    ctx.globalCompositeOperation = "source-over";
    const coreRadius = maxRadius * 0.35;

    ctx.fillStyle = this.hsla(this.hueBase + 25, 100, 95, 0.95);
    ctx.shadowBlur = 15; // Reduced from 80-110
    ctx.shadowColor = this.hsla(this.hueBase + 20, 100, 85, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.fill();

    ctx.restore();
  }

  public getCurrentPattern(): Pattern {
    return this.currentPattern;
  }

  public getNextPattern(): Pattern {
    return this.nextPattern;
  }

  public getFormattedPatternName(pattern: Pattern): string {
    return this.formatPatternName(pattern);
  }

  public getPatternDuration(): number {
    return this.patternDuration;
  }

  public setPatternDuration(value: number): void {
    this.patternDuration = Math.max(10, Math.min(10000, value));
  }

  public getTransitionSpeed(): number {
    return this.transitionSpeed;
  }

  public setTransitionSpeed(value: number): void {
    this.transitionSpeed = Math.max(0.001, Math.min(0.1, value));
  }

  private initializeHydrogenElectrons(): void {
    if (this.hydrogenElectrons.length > 0) return;

    const electronCount = 50;
    const twoPi = FlowFieldRenderer.TWO_PI;

    for (let i = 0; i < electronCount; i++) {
      this.hydrogenElectrons.push({
        x: 0,
        y: 0,
        z: 0,
        angle: Math.random() * twoPi,
        phase: Math.random() * twoPi,
        speed: 0.01 + Math.random() * 0.02,
      });
    }
  }

  private renderHydrogenElectronOrbitals(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.4;

    if (this.hydrogenElectrons.length === 0) {
      this.initializeHydrogenElectrons();
    }

    this.hydrogenEnergyLevelTimer += 1;
    const transitionSpeed = 1 + audioIntensity * 2;
    if (
      this.hydrogenEnergyLevelTimer >=
      this.hydrogenEnergyLevelDuration / transitionSpeed
    ) {
      this.hydrogenEnergyLevelTimer = 0;
      this.hydrogenEnergyLevel =
        (this.hydrogenEnergyLevel % this.MAX_ENERGY_LEVEL) + 1;
    }

    const n = this.hydrogenEnergyLevel;
    const baseRadius = maxRadius * 0.3;
    const orbitalRadius = baseRadius * n * n;

    ctx.save();
    ctx.translate(this.centerX, this.centerY);
    const nucleusRadius = 8 + bassIntensity * 12;
    const nucleusGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      nucleusRadius,
    );
    nucleusGradient.addColorStop(
      0,
      this.hsla(0, 100, 50, 0.8 + audioIntensity * 0.2),
    );
    nucleusGradient.addColorStop(
      0.5,
      this.hsla(0, 100, 60, 0.4 + audioIntensity * 0.3),
    );
    nucleusGradient.addColorStop(1, this.hsla(0, 100, 70, 0));
    ctx.fillStyle = nucleusGradient;
    ctx.beginPath();
    ctx.arc(0, 0, nucleusRadius, 0, twoPi);
    ctx.fill();
    ctx.fillStyle = this.hsla(0, 100, 40, 0.9 + audioIntensity * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, twoPi);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    if (n === 1) {
      this.drawHydrogen1sOrbital(
        ctx,
        orbitalRadius,
        audioIntensity,
        trebleIntensity,
      );
    } else if (n === 2) {
      this.drawHydrogen2sOrbital(
        ctx,
        orbitalRadius * 0.5,
        audioIntensity,
        trebleIntensity,
      );
      this.drawHydrogen2pOrbitals(
        ctx,
        orbitalRadius,
        audioIntensity,
        midIntensity,
        trebleIntensity,
      );
    } else if (n === 3) {
      this.drawHydrogen3sOrbital(
        ctx,
        orbitalRadius * 0.33,
        audioIntensity,
        trebleIntensity,
      );
      this.drawHydrogen3pOrbitals(
        ctx,
        orbitalRadius * 0.66,
        audioIntensity,
        midIntensity,
        trebleIntensity,
      );
      this.drawHydrogen3dOrbitals(
        ctx,
        orbitalRadius,
        audioIntensity,
        bassIntensity,
        midIntensity,
        trebleIntensity,
      );
    } else {
      for (let shell = 1; shell <= n; shell++) {
        const shellRadius = (orbitalRadius * shell) / n;
        this.drawHydrogenShell(
          ctx,
          shellRadius,
          shell,
          audioIntensity,
          trebleIntensity,
        );
      }
    }
    ctx.restore();

    this.updateHydrogenElectrons(
      n,
      orbitalRadius,
      audioIntensity,
      bassIntensity,
    );
    this.drawHydrogenElectrons(ctx, n, audioIntensity, trebleIntensity);
  }

  private drawHydrogen1sOrbital(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.05) * (5 + trebleIntensity * 15);
    const currentRadius = radius + pulse;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
    const hue = this.fastMod360(this.hueBase + 180);
    gradient.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.1 + audioIntensity * 0.2),
    );
    gradient.addColorStop(
      0.5,
      this.hsla(hue, 70, 60, 0.05 + trebleIntensity * 0.15),
    );
    gradient.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.fill();
    ctx.strokeStyle = this.hsla(hue, 70, 60, 0.4 + audioIntensity * 0.3);
    ctx.lineWidth = 2 + trebleIntensity * 3;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.stroke();
  }

  private drawHydrogen2sOrbital(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.04) * (8 + trebleIntensity * 20);
    const currentRadius = radius + pulse;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
    const hue = this.fastMod360(this.hueBase + 200);
    gradient.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.08 + audioIntensity * 0.15),
    );
    gradient.addColorStop(
      0.6,
      this.hsla(hue, 70, 60, 0.03 + trebleIntensity * 0.1),
    );
    gradient.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.fill();
    ctx.strokeStyle = this.hsla(hue, 70, 60, 0.35 + audioIntensity * 0.25);
    ctx.lineWidth = 1.5 + trebleIntensity * 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.stroke();
  }

  private drawHydrogen2pOrbitals(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    midIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.06) * (10 + midIntensity * 20);
    const currentRadius = radius + pulse;

    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius,
      0,
      audioIntensity,
      trebleIntensity,
    );
    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius,
      Math.PI / 2,
      audioIntensity,
      trebleIntensity,
    );
    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius * 0.7,
      Math.PI / 4,
      audioIntensity,
      trebleIntensity,
    );
  }

  private drawHydrogen3sOrbital(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.03) * (12 + trebleIntensity * 25);
    const currentRadius = radius + pulse;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
    const hue = this.fastMod360(this.hueBase + 220);
    gradient.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.06 + audioIntensity * 0.12),
    );
    gradient.addColorStop(
      0.5,
      this.hsla(hue, 70, 60, 0.02 + trebleIntensity * 0.08),
    );
    gradient.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.fill();
    ctx.strokeStyle = this.hsla(hue, 70, 60, 0.3 + audioIntensity * 0.2);
    ctx.lineWidth = 1 + trebleIntensity * 2;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.stroke();
  }

  private drawHydrogen3pOrbitals(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    midIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.05) * (15 + midIntensity * 25);
    const currentRadius = radius + pulse;
    const rotation = this.time * 0.01;

    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius,
      rotation,
      audioIntensity,
      trebleIntensity,
    );
    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius,
      rotation + Math.PI / 2,
      audioIntensity,
      trebleIntensity,
    );
    this.drawHydrogenDumbbellOrbital(
      ctx,
      currentRadius * 0.8,
      rotation + Math.PI / 4,
      audioIntensity,
      trebleIntensity,
    );
  }

  private drawHydrogen3dOrbitals(
    ctx: CanvasRenderingContext2D,
    radius: number,
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse = this.fastSin(this.time * 0.04) * (20 + bassIntensity * 30);
    const currentRadius = radius + pulse;
    const rotation = this.time * 0.008;
    const twoPi = FlowFieldRenderer.TWO_PI;

    for (let i = 0; i < 5; i++) {
      const angle = (i * twoPi) / 5 + rotation;
      this.drawHydrogenCloverleafOrbital(
        ctx,
        currentRadius,
        angle,
        audioIntensity,
        trebleIntensity,
      );
    }
  }

  private drawHydrogenDumbbellOrbital(
    ctx: CanvasRenderingContext2D,
    radius: number,
    angle: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    ctx.save();
    ctx.rotate(angle);

    const lobeSize = radius * 0.4;
    const lobeDistance = radius * 0.6;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const hue = this.fastMod360(this.hueBase + 160);

    const gradient1 = ctx.createRadialGradient(
      -lobeDistance,
      0,
      0,
      -lobeDistance,
      0,
      lobeSize,
    );
    gradient1.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.3 + audioIntensity * 0.3),
    );
    gradient1.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient1;
    ctx.beginPath();
    ctx.arc(-lobeDistance, 0, lobeSize, 0, twoPi);
    ctx.fill();

    const gradient2 = ctx.createRadialGradient(
      lobeDistance,
      0,
      0,
      lobeDistance,
      0,
      lobeSize,
    );
    gradient2.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.3 + audioIntensity * 0.3),
    );
    gradient2.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient2;
    ctx.beginPath();
    ctx.arc(lobeDistance, 0, lobeSize, 0, twoPi);
    ctx.fill();

    ctx.strokeStyle = this.hsla(hue, 70, 60, 0.2 + audioIntensity * 0.2);
    ctx.lineWidth = 1 + trebleIntensity * 2;
    ctx.beginPath();
    ctx.moveTo(-lobeDistance, 0);
    ctx.lineTo(lobeDistance, 0);
    ctx.stroke();

    ctx.restore();
  }

  private drawHydrogenCloverleafOrbital(
    ctx: CanvasRenderingContext2D,
    radius: number,
    angle: number,
    audioIntensity: number,
    _trebleIntensity: number,
  ): void {
    ctx.save();
    ctx.rotate(angle);

    const lobeSize = radius * 0.25;
    const lobeDistance = radius * 0.7;
    const hue = this.fastMod360(this.hueBase + 240);
    const twoPi = FlowFieldRenderer.TWO_PI;

    for (let i = 0; i < 4; i++) {
      const lobeAngle = (i * twoPi) / 4;
      const x = this.fastCos(lobeAngle) * lobeDistance;
      const y = this.fastSin(lobeAngle) * lobeDistance;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, lobeSize);
      gradient.addColorStop(
        0,
        this.hsla(hue, 70, 60, 0.25 + audioIntensity * 0.25),
      );
      gradient.addColorStop(1, this.hsla(hue, 70, 60, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, lobeSize, 0, twoPi);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawHydrogenShell(
    ctx: CanvasRenderingContext2D,
    radius: number,
    shell: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    const pulse =
      this.fastSin(this.time * 0.02 + shell) * (5 + trebleIntensity * 15);
    const currentRadius = radius + pulse;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const hue = this.fastMod360(this.hueBase + shell * 60 + this.time * 0.5);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
    gradient.addColorStop(
      0,
      this.hsla(hue, 70, 60, 0.05 + audioIntensity * 0.1),
    );
    gradient.addColorStop(1, this.hsla(hue, 70, 60, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.fill();
    ctx.strokeStyle = this.hsla(hue, 70, 60, 0.25 + audioIntensity * 0.2);
    ctx.lineWidth = 1 + trebleIntensity * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, twoPi);
    ctx.stroke();
  }

  private updateHydrogenElectrons(
    n: number,
    orbitalRadius: number,
    audioIntensity: number,
    bassIntensity: number,
  ): void {
    this.hydrogenElectrons.forEach((electron) => {
      const speed = electron.speed * (1 + audioIntensity * 2 + bassIntensity);
      electron.angle += speed / (n * n);
      electron.phase += speed * 0.5;

      const radius = orbitalRadius * (0.8 + this.fastSin(electron.phase) * 0.2);
      electron.x = this.fastCos(electron.angle) * radius;
      electron.y = this.fastSin(electron.angle) * radius;
      electron.z = this.fastSin(electron.phase) * radius * 0.3;
    });
  }

  private drawHydrogenElectrons(
    ctx: CanvasRenderingContext2D,
    n: number,
    audioIntensity: number,
    trebleIntensity: number,
  ): void {
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const twoPi = FlowFieldRenderer.TWO_PI;

    this.hydrogenElectrons.forEach((electron) => {
      const size = (3 + trebleIntensity * 5) / n;
      const alpha = 0.6 + audioIntensity * 0.4;
      const hue = this.fastMod360(n * 40 + this.time * 2);

      const gradient = ctx.createRadialGradient(
        electron.x,
        electron.y,
        0,
        electron.x,
        electron.y,
        size * 2,
      );
      gradient.addColorStop(0, this.hsla(hue, 100, 70, alpha));
      gradient.addColorStop(0.5, this.hsla(hue, 100, 60, alpha * 0.5));
      gradient.addColorStop(1, this.hsla(hue, 100, 50, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, size * 2, 0, twoPi);
      ctx.fill();

      ctx.fillStyle = this.hsla(hue, 100, 90, alpha);
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, size, 0, twoPi);
      ctx.fill();
    });

    ctx.restore();
  }

  private renderPlasmaStorm(
    audioIntensity: number,
    bassIntensity: number,
    _trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const baseRadius = 120 + ((bassIntensity * 60) | 0);
    const layers = Math.max(
      2,
      ((4 + ((audioIntensity * 2) | 0)) * detailScale) | 0,
    );
    const time2 = time * 2;
    const time15 = time * 1.5;
    const time3 = time * 3;

    for (let layer = 0; layer < layers; layer++) {
      const layerProgress = layer / layers;
      const radius = baseRadius * (0.3 + layerProgress * 0.7);
      const rotation = time * (1 + layer * 0.2) * (layer & 1 ? 1 : -1);
      const layerHue = this.fastMod360(
        this.hueBase + layer * 30 + ((time * 5) | 0),
      );

      ctx.strokeStyle = this.hsla(
        layerHue,
        85,
        60 + ((layerProgress * 20) | 0),
        0.4 + audioIntensity * 0.3 - layerProgress * 0.2,
      );
      ctx.lineWidth = (2 + bassIntensity * 1.5 - layerProgress) * detailScale;
      ctx.beginPath();

      const points = Math.max(72, (120 * detailScale) | 0);
      const pointStep = FlowFieldRenderer.TWO_PI / points;
      const layer2 = layer << 1;
      const layer3 = layer * 3;
      const audio3 = (audioIntensity * 3) | 0;

      for (let i = 0; i <= points; i++) {
        const angle = i * pointStep + rotation;
        const angle3 = angle * 3;
        const angle5 = angle * 5;
        const angle7 = angle * 7;
        const wave1 = this.fastSin(angle3 + time2) * (5 + layer2);
        const wave2 = this.fastCos(angle5 - time15) * (3 + layer);
        const wave3 = this.fastSin(angle7 + time3) * (2 + audio3);
        const currentRadius = radius + wave1 + wave2 + wave3;

        const x = this.fastCos(angle) * currentRadius;
        const y = this.fastSin(angle) * currentRadius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    const centerHue = this.fastMod360(this.hueBase + ((time * 10) | 0));
    const centerRadius = 40 + ((bassIntensity * 30) | 0);
    ctx.fillStyle = this.hsla(centerHue, 95, 75, 0.6 + audioIntensity * 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    ctx.restore();
  }

  private renderBitfieldMatrix(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0005;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const cellSize =
      (16 + ((audioIntensity * 6) | 0)) *
      (detailScale < 1 ? 1 / detailScale : 1);
    const cols = ((this.width / cellSize) | 0) + 1;
    const rows = ((this.height / cellSize) | 0) + 1;
    const rotation = time * 0.3;
    const halfCols = cols * 0.5;
    const halfRows = rows * 0.5;
    const time2 = time * 2;
    const cellSize04 = cellSize * 0.4;
    const cellSize01 = cellSize * 0.1;
    const halfSize = cellSize * 0.5;

    for (let row = 0; row < rows; row++) {
      const y = (row - halfRows) * cellSize;
      const ySq = y * y;
      const cellHashRow = row * 97;

      for (let col = 0; col < cols; col++) {
        const x = (col - halfCols) * cellSize;
        const distSq = x * x + ySq;
        const dist = this.fastSqrt(distSq < 1 ? 1 : distSq);
        const alpha = 0.3 + audioIntensity * 0.4 - (dist / 400) * 0.3;
        if (alpha <= 0) continue;
        const cellHash = ((col * 73) ^ cellHashRow) & 0xff;
        const pattern = (cellHash >> 4) & 0x0f;
        const hue = this.fastMod360(
          this.hueBase + ((dist * 0.1) | 0) + pattern * 22.5,
        );

        const size =
          cellSize04 + this.fastSin(time2 + dist * 0.01) * cellSize01;
        const halfSizeScaled = size * 0.5;

        ctx.fillStyle = this.hsla(hue, 85, 60, alpha);

        if (pattern < 8 || detailScale < 0.85) {
          ctx.fillRect(x - halfSizeScaled, y - halfSizeScaled, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, halfSizeScaled, 0, FlowFieldRenderer.TWO_PI);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private renderMandelbrotSpiral(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const zoom = 0.6 + bassIntensity * 0.2;
    const panX = this.fastSin(time * 0.5) * 0.2;
    const panY = this.fastCos(time * 0.7) * 0.15;
    const maxIter = Math.max(
      14,
      ((30 + ((audioIntensity * 10) | 0)) * detailScale) | 0,
    );
    const baseRadius = 150;
    const rings = Math.max(
      3,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const time02 = time * 0.2;
    const time2 = time * 2;

    for (let ring = 0; ring < rings; ring++) {
      const ringProgress = ring / rings;
      const radius = baseRadius * (0.2 + ringProgress * 0.8);
      const ringHue = this.fastMod360(
        this.hueBase + ring * 45 + ((time * 10) | 0),
      );

      const points = Math.max(80, (120 * detailScale) | 0);
      const pointStep = FlowFieldRenderer.TWO_PI / points;
      const maxLocalIter = (maxIter * (1 - ringProgress * 0.5)) | 0;
      const ring2 = ring << 1;
      ctx.strokeStyle = this.hsla(
        ringHue,
        90,
        65 + ((ringProgress * 15) | 0),
        0.5 + audioIntensity * 0.3 - ringProgress * 0.2,
      );
      ctx.lineWidth = (2 + bassIntensity * 1.5 - ringProgress) * detailScale;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = i * pointStep + time02;
        const cosAngle = this.fastCos(angle);
        const sinAngle = this.fastSin(angle);
        const x0 = (cosAngle * radius * 0.3 + panX) * zoom;
        const y0 = (sinAngle * radius * 0.3 + panY) * zoom;

        let x = x0;
        let y = y0;
        let iter = 0;
        let xSq = x * x;
        let ySq = y * y;

        while (iter < maxLocalIter && xSq + ySq < 4) {
          const xt = xSq - ySq + x0;
          y = 2 * x * y + y0;
          x = xt;
          xSq = x * x;
          ySq = y * y;
          iter++;
        }

        const iterRatio = iter / maxLocalIter;
        const wave = this.fastSin(angle * 3 + time2) * (5 + ring2);
        const currentRadius = radius * (0.8 + iterRatio * 0.2) + wave;

        const px = cosAngle * currentRadius;
        const py = sinAngle * currentRadius;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      ctx.stroke();
    }

    const spiralTurns = 3 + ((audioIntensity * 1) | 0);
    const spiralPoints = Math.max(80, (150 * detailScale) | 0);
    const spiralHue = this.fastMod360(this.hueBase + 180 + ((time * 15) | 0));

    ctx.strokeStyle = this.hsla(spiralHue, 95, 70, 0.4 + trebleIntensity * 0.2);
    ctx.lineWidth = (2 + bassIntensity * 1.5) * detailScale;
    ctx.beginPath();

    const spiralStep = 1 / spiralPoints;
    for (let i = 0; i < spiralPoints; i++) {
      const t = i * spiralStep;
      const angle = t * spiralTurns * FlowFieldRenderer.TWO_PI + time * 0.5;
      const radius = t * 200;
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  private renderQuantumResonance(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0004;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const cellSize = 60 * (detailScale < 1 ? 1 / detailScale : 1);
    const cols = ((this.width / cellSize) | 0) + 1;
    const rows = ((this.height / cellSize) | 0) + 1;
    const halfCols = cols * 0.5;
    const halfRows = rows * 0.5;
    const time10 = time * 10;
    const cellSize025 = cellSize * 0.25;
    const cellSize015 = cellSize * 0.15;
    const cellSize05 = cellSize * 0.5;

    for (let row = 0; row < rows; row++) {
      const y = (row - halfRows) * cellSize;
      const ySq = y * y;
      const cellHashRow = row * 97;

      for (let col = 0; col < cols; col++) {
        const x = (col - halfCols) * cellSize;
        const distSq = x * x + ySq;
        if (distSq > 40000) continue;
        const dist = this.fastSqrt(distSq < 1 ? 1 : distSq);
        const cellHash = ((col * 73) ^ cellHashRow) & 0xff;
        const frequency = 0.05 + (cellHash & 0x0f) * 0.005;
        const wave = this.fastSin(time10 + dist * 0.02) * cellSize015;
        const hue = this.fastMod360(
          this.hueBase + ((dist * 0.2) | 0) + ((cellHash * 1.4) | 0),
        );
        const radius = cellSize025 + (wave < 0 ? -wave : wave);

        const alpha = 0.5 + audioIntensity * 0.3 - (dist / 400) * 0.3;
        if (alpha <= 0) continue;

        ctx.fillStyle = this.hsla(hue, 90, 70, alpha);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, FlowFieldRenderer.TWO_PI);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderMorseAurora(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0004;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const bands = Math.max(4, (8 * detailScale) | 0);
    const invBands = 1 / bands;
    const baseRadius = 180;
    const time05 = time * 0.5;
    const time8 = time * 8;

    for (let band = 0; band < bands; band++) {
      const bandProgress = band * invBands;
      const radius = baseRadius * (0.4 + bandProgress * 0.6);
      const bandHue = this.fastMod360(this.hueBase + band * 30 + (time8 | 0));

      const wavePhase = time05 + band * 0.3;
      const waveAmplitude =
        (20 + ((audioIntensity * 30) | 0) + ((bassIntensity * 15) | 0)) *
        (detailScale < 1 ? detailScale : 1);
      const waveAmp05 = waveAmplitude * 0.5;
      const waveAmp03 = waveAmplitude * 0.3;
      const waveAmp02 = waveAmplitude * 0.2;
      const wavePhase07 = wavePhase * 0.7;
      const wavePhase13 = wavePhase * 1.3;

      ctx.strokeStyle = this.hsla(
        bandHue,
        88,
        65 + ((bandProgress * 10) | 0),
        0.4 + audioIntensity * 0.3 - bandProgress * 0.15,
      );
      ctx.lineWidth = (2.5 + bassIntensity * 1.5 - bandProgress) * detailScale;
      ctx.beginPath();

      const points = Math.max(96, (180 * detailScale) | 0);
      const pointStep = twoPi / points;
      for (let i = 0; i <= points; i++) {
        const angle = i * pointStep;
        const angle2 = angle * 2;
        const angle3 = angle * 3;
        const angle5 = angle * 5;
        const wave1 = this.fastSin(angle2 + wavePhase) * waveAmp05;
        const wave2 = this.fastCos(angle3 - wavePhase07) * waveAmp03;
        const wave3 = this.fastSin(angle5 + wavePhase13) * waveAmp02;
        const currentRadius = radius + wave1 + wave2 + wave3;

        const x = this.fastCos(angle) * currentRadius;
        const y = this.fastSin(angle) * currentRadius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderChromaticAberration(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const layers = 4 + ((audioIntensity * 2) | 0);
    const baseRadius = 140;
    const time2 = time * 2;
    const time15 = time * 1.5;
    const time8 = time * 8;

    for (let layer = 0; layer < layers; layer++) {
      const layerProgress = layer / layers;
      const radius = baseRadius * (0.3 + layerProgress * 0.7);
      const rotation = time * (1 + layer * 0.15) * (layer & 1 ? 1 : -1);
      const layerHue = this.fastMod360(this.hueBase + layer * 60 + (time8 | 0));

      const points = 120;
      const pointStep = FlowFieldRenderer.TWO_PI / points;
      const layer3 = layer + 3;
      const layer05 = layer * 0.5;

      ctx.strokeStyle = this.hsla(
        layerHue,
        90,
        65 + ((layerProgress * 15) | 0),
        0.5 + audioIntensity * 0.3 - layerProgress * 0.2,
      );
      ctx.lineWidth = 3 + bassIntensity * 2 - layerProgress;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = i * pointStep + rotation;
        const angle4 = angle * 4;
        const angle6 = angle * 6;
        const wave1 = this.fastSin(angle4 + time2) * layer3;
        const wave2 = this.fastCos(angle6 - time15) * (2 + layer05);
        const currentRadius = radius + wave1 + wave2;

        const x = this.fastCos(angle) * currentRadius;
        const y = this.fastSin(angle) * currentRadius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderMengerSponge(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const rotation = time * 0.3;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const depth = Math.max(
      1,
      (2 + ((audioIntensity * 1) | 0) - (detailScale < 0.85 ? 1 : 0)) | 0,
    );
    const baseSize = 180 / 3 ** (depth - 1);
    const drawMenger = (
      x: number,
      y: number,
      size: number,
      currentDepth: number,
      localRotation: number,
    ): void => {
      if (currentDepth === 0 || size < 3) return;
      const invDepth = 1 / (depth - currentDepth + 1);
      const hue = this.fastMod360(
        this.hueBase + currentDepth * 50 + ((time * 5) | 0),
      );

      const subSize = size / 3;
      const offset = size / 3;
      const halfSize = size * 0.5;
      const halfSubSize = subSize * 0.5;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(localRotation + rotation * (currentDepth * 0.1));

      for (let dx = 0; dx < 3; dx++) {
        for (let dy = 0; dy < 3; dy++) {
          if (dx === 1 && dy === 1) continue;
          const subX = -halfSize + dx * offset + offset * 0.5;
          const subY = -halfSize + dy * offset + offset * 0.5;

          ctx.fillStyle = this.hsla(
            hue,
            88,
            55 + ((invDepth * 25) | 0),
            0.4 + audioIntensity * 0.3 - invDepth * 0.2,
          );
          ctx.strokeStyle = this.hsla(
            this.fastMod360(hue + 120),
            90,
            65,
            0.7 - invDepth * 0.3,
          );
          ctx.lineWidth = (1.5 + bassIntensity * 0.5) * detailScale;

          ctx.fillRect(
            subX - halfSubSize,
            subY - halfSubSize,
            subSize,
            subSize,
          );
          if (detailScale >= 0.85) {
            ctx.strokeRect(
              subX - halfSubSize,
              subY - halfSubSize,
              subSize,
              subSize,
            );
          }

          if (currentDepth > 1) {
            drawMenger(
              subX,
              subY,
              subSize,
              currentDepth - 1,
              localRotation + 0.15,
            );
          }
        }
      }

      ctx.restore();
    };

    drawMenger(0, 0, baseSize * 3, depth, 0);

    ctx.restore();
  }

  private renderPerlinNoiseField(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const scale = 60 + ((audioIntensity * 40) | 0);
    const octaves = 2 + ((bassIntensity * 1) | 0);
    const baseRadius = 160;
    const rings = Math.max(
      3,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const time03 = time * 0.3;
    const time02 = time * 0.2;
    const time8 = time * 8;

    for (let ring = 0; ring < rings; ring++) {
      const ringProgress = ring / rings;
      const radius = baseRadius * (0.2 + ringProgress * 0.8);
      const ringHue = this.fastMod360(this.hueBase + ring * 45 + (time8 | 0));

      ctx.strokeStyle = this.hsla(
        ringHue,
        85,
        60 + ((ringProgress * 20) | 0),
        0.4 + audioIntensity * 0.3 - ringProgress * 0.2,
      );
      ctx.lineWidth = (2.5 + bassIntensity * 1.5 - ringProgress) * detailScale;
      ctx.beginPath();

      const points = Math.max(80, (120 * detailScale) | 0);
      const pointStep = FlowFieldRenderer.TWO_PI / points;
      const invScale = 1 / scale;
      const ring2 = ring << 1;
      for (let i = 0; i <= points; i++) {
        const angle = i * pointStep;
        const cosAngle = this.fastCos(angle);
        const sinAngle = this.fastSin(angle);
        const nx = cosAngle * radius * invScale + time03;
        const ny = sinAngle * radius * invScale + time02;

        const xi = nx | 0;
        const yi = ny | 0;
        const hash1 = ((xi * 73) ^ (yi * 97)) & 0xff;
        const hash2 = ((hash1 * 101) ^ ((this.time >> 2) & 0xff)) & 0xff;
        const fx = nx - xi;
        const fy = ny - yi;
        const u = fx * fx * (3 - 2 * fx);
        const v = fy * fy * (3 - 2 * fy);
        const grad = (hash2 / 255) * 2 - 1;
        const value = grad * u * v;
        const wave = value * (15 + ring2);

        const currentRadius = radius + wave;
        const x = cosAngle * currentRadius;
        const y = sinAngle * currentRadius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSuperformula(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const m = 4 + ((bassIntensity * 4) | 0);
    const n1 = 1.2 + audioIntensity * 1.5;
    const n2 = 1.2 + trebleIntensity * 1.5;
    const n3 = 1.1 + (audioIntensity + bassIntensity) * 1.5 * 0.5;
    const rotation = time * 0.5;

    const layers = Math.max(
      2,
      ((4 + ((audioIntensity * 2) | 0)) * detailScale) | 0,
    );
    const baseRadius = 120;

    for (let layer = 0; layer < layers; layer++) {
      const layerProgress = layer / layers;
      const maxRadius = baseRadius * (0.4 + layerProgress * 0.6);
      const layerHue = this.fastMod360(this.hueBase + layer * 90 + time * 10);

      ctx.strokeStyle = this.hsla(
        layerHue,
        92,
        65 + layerProgress * 15,
        0.5 + audioIntensity * 0.3 - layerProgress * 0.2,
      );
      ctx.lineWidth =
        (2.5 + trebleIntensity * 1.5 - layerProgress) * detailScale;
      ctx.fillStyle = this.hsla(layerHue, 88, 50, 0.15 + audioIntensity * 0.15);
      ctx.beginPath();

      const points = Math.max(120, (240 * detailScale) | 0);
      const pointStep = FlowFieldRenderer.TWO_PI / points;
      const layerDir = layer & 1 ? 1 : -1;
      const m4 = m / 4;
      const invN3 = -1 / n3;

      for (let i = 0; i <= points; i++) {
        const φ = i * pointStep + rotation * layerDir;
        const angle = m4 * φ;

        const cosVal = this.fastCos(angle);
        const sinVal = this.fastSin(angle);
        const absCos = cosVal < 0 ? -cosVal : cosVal;
        const absSin = sinVal < 0 ? -sinVal : sinVal;

        const cosPow = absCos ** n1;
        const sinPow = absSin ** n2;
        const r = (cosPow + sinPow) ** invN3 * maxRadius;

        const x = this.fastCos(φ) * r;
        const y = this.fastSin(φ) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (layer < layers - 1) {
        const innerRadius = maxRadius * 0.6;
        ctx.strokeStyle = this.hsla(
          this.fastMod360(layerHue + 45),
          85,
          55,
          0.2 + trebleIntensity * 0.1,
        );
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, FlowFieldRenderer.TWO_PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderVoronoi(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const seedCount = 12 + ((audioIntensity * 8) | 0);
    const seedStride = 3;
    const requiredSeedLength = seedCount * seedStride;
    let seedData = this.voronoiSeedData;
    if (seedData.length < requiredSeedLength) {
      seedData = new Float32Array(requiredSeedLength);
      this.voronoiSeedData = seedData;
    }
    const baseRadius = 180;

    for (let i = 0; i < seedCount; i++) {
      const angle = (i / seedCount) * FlowFieldRenderer.TWO_PI + time * 0.3;
      const radius = baseRadius * (0.3 + (i % 3) * 0.15);
      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;
      const hue = this.fastMod360(
        this.hueBase + (i * 360) / seedCount + time * 5,
      );
      const idx = i * seedStride;
      seedData[idx] = x;
      seedData[idx + 1] = y;
      seedData[idx + 2] = hue;
    }

    const pixelCount = this.width * this.height;
    let cellSize = 6;
    if (pixelCount > 900_000) cellSize = 10;
    else if (pixelCount > 700_000) cellSize = 8;
    else if (pixelCount > 500_000) cellSize = 7;
    if (this.qualityScale < 1) {
      cellSize = Math.round(cellSize / this.qualityScale);
    }
    const halfCell = cellSize * 0.5;
    const halfHeight = this.height * 0.5;
    const halfWidth = this.width * 0.5;
    const maxDistSq = 40000;
    const maxRadius = 200;
    const limit = Math.min(halfWidth, halfHeight, maxRadius + cellSize);
    for (let py = -limit; py <= limit; py += cellSize) {
      const pySq = py * py;
      if (pySq > maxDistSq) continue;

      for (let px = -limit; px <= limit; px += cellSize) {
        const distSq = px * px + pySq;
        if (distSq > maxDistSq) continue;

        let minDistSq = Infinity;
        let nearestSeedIndex = 0;

        for (let s = 0; s < seedCount; s++) {
          const seedIndex = s * seedStride;
          const seedX = seedData[seedIndex] ?? 0;
          const seedY = seedData[seedIndex + 1] ?? 0;
          const dx = px - seedX;
          const dy = py - seedY;
          const distSqCalc = dx * dx + dy * dy;

          if (distSqCalc < minDistSq) {
            minDistSq = distSqCalc;
            nearestSeedIndex = seedIndex;
            if (minDistSq < 1) break;
          }
        }

        const dist = this.fastSqrt(minDistSq < 1 ? 1 : minDistSq);
        const alpha = 0.6 - (dist / 300) * 0.4;
        if (alpha <= 0) continue;

        const lightness = 0.5 + (dist / 400) * 0.2;
        const hue = seedData[nearestSeedIndex + 2] ?? this.hueBase;
        ctx.fillStyle = this.hsla(hue, 88, (lightness * 100) | 0, alpha);
        ctx.fillRect(px - halfCell, py - halfCell, cellSize, cellSize);
      }
    }

    const seedRadius = 6 + ((bassIntensity * 4) | 0);
    for (let s = 0; s < seedCount; s++) {
      const seedIndex = s * seedStride;
      const seedX = seedData[seedIndex] ?? 0;
      const seedY = seedData[seedIndex + 1] ?? 0;
      const seedHue = seedData[seedIndex + 2] ?? this.hueBase;
      ctx.fillStyle = this.hsla(seedHue, 95, 75, 0.8);
      ctx.beginPath();
      ctx.arc(seedX, seedY, seedRadius, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderDragonCurve(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const iterations = Math.max(
      9,
      (13 + ((audioIntensity * 3) | 0) - (detailScale < 0.85 ? 2 : 0)) | 0,
    );
    const segmentLength =
      (7 - ((iterations - 13) >> 2)) * (detailScale < 1 ? detailScale : 1);
    const rotation = time * 0.3;

    const curves = Math.max(1, (3 * detailScale) | 0);
    for (let curve = 0; curve < curves; curve++) {
      const curveRotation =
        (curve / curves) * FlowFieldRenderer.TWO_PI + rotation;
      const curveHue = this.fastMod360(this.hueBase + curve * 120 + time * 8);

      ctx.strokeStyle = this.hsla(
        curveHue,
        92,
        65,
        0.5 + audioIntensity * 0.3 - curve * 0.1,
      );
      ctx.lineWidth = (2 + trebleIntensity * 1.5) * detailScale;
      ctx.beginPath();

      let x = 0;
      let y = 0;
      let angle = curveRotation;
      ctx.moveTo(x, y);

      const maxSteps = Math.min(
        1 << iterations,
        Math.max(1000, (4000 * detailScale) | 0),
      );
      const pi2 = Math.PI / 2;
      for (let step = 0; step < maxSteps; step++) {
        let bits = step;
        let bitCount = 0;
        while (bits) {
          bits &= bits - 1;
          bitCount++;
        }

        const turn = (bitCount & 1) === 1 ? -pi2 : pi2;
        angle += turn;

        x += this.fastCos(angle) * segmentLength;
        y += this.fastSin(angle) * segmentLength;

        ctx.lineTo(x, y);
      }

      ctx.stroke();

      ctx.fillStyle = this.hsla(curveHue, 85, 50, 0.1 + audioIntensity * 0.1);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderLangtonsAnt(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const baseGridSize = 60 + ((audioIntensity * 20) | 0);
    const pixelCount = this.width * this.height;
    const baseGridScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    const gridScale = baseGridScale * this.qualityScale;
    const gridSize = Math.max(30, (baseGridSize * gridScale) | 0);
    const cellSize = Math.min(this.width, this.height) / gridSize;
    const time = this.time * 0.0001;
    let antX = gridSize >> 1;
    let antY = gridSize >> 1;
    let antDir = ((this.time >> 5) & 3) % 4;

    let grid = this.langtonsAntGrid;
    const gridLength = gridSize * gridSize;
    if (this.langtonsAntGridSize !== gridSize || grid.length < gridLength) {
      grid = new Uint8Array(gridLength);
      this.langtonsAntGrid = grid;
      this.langtonsAntGridSize = gridSize;
    } else {
      grid.fill(0);
    }

    const steps = Math.max(
      60,
      ((100 + ((audioIntensity * 200) | 0)) * gridScale) | 0,
    );
    for (let step = 0; step < steps; step++) {
      const cellIdx = antY * gridSize + antX;
      const cellVal = grid[cellIdx];

      if (cellVal === 0) {
        antDir = (antDir + 1) & 3;
        grid[cellIdx] = 1;
      } else {
        antDir = (antDir - 1) & 3;
        grid[cellIdx] = 0;
      }

      switch (antDir) {
        case 0:
          antX = (antX + 1) % gridSize;
          break;
        case 1:
          antY = (antY + 1) % gridSize;
          break;
        case 2:
          antX = (antX - 1 + gridSize) % gridSize;
          break;
        case 3:
          antY = (antY - 1 + gridSize) % gridSize;
          break;
      }
    }

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const cellVal = grid[gy * gridSize + gx];
        const x = (gx - gridSize / 2) * cellSize;
        const y = (gy - gridSize / 2) * cellSize;
        const dist = this.fastSqrt(x * x + y * y);

        const hue = cellVal
          ? this.fastMod360(this.hueBase + dist * 0.1)
          : this.fastMod360(this.hueBase + 180 + dist * 0.05);
        const alpha = 0.4 + audioIntensity * 0.3 - (dist / 400) * 0.3;

        ctx.fillStyle = this.hsla(hue, 88, cellVal ? 65 : 40, alpha);
        const halfCell = cellSize * 0.5;
        ctx.fillRect(x - halfCell, y - halfCell, cellSize, cellSize);
      }
    }

    ctx.restore();
  }

  private renderCelticKnot(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const knots = 4 + ((audioIntensity * 2) | 0);
    const baseRadius = 140;

    for (let k = 0; k < knots; k++) {
      const knotProgress = k / knots;
      const knotRadius = baseRadius * (0.5 + knotProgress * 0.5);
      const segments = 16 + (k & 1 ? 12 : 0);
      const rotation = time * 0.5 * (k & 1 ? 1 : -1);
      const knotHue = this.fastMod360(this.hueBase + k * 45 + time * 6);

      ctx.strokeStyle = this.hsla(
        knotHue,
        88,
        60 + knotProgress * 15,
        0.5 + audioIntensity * 0.3 - knotProgress * 0.15,
      );
      ctx.lineWidth = 3.5 + bassIntensity * 2 - knotProgress;
      ctx.fillStyle = this.hsla(knotHue, 85, 50, 0.15 + audioIntensity * 0.15);

      const segmentStep = FlowFieldRenderer.TWO_PI / segments;
      const knotRadius08 = knotRadius * 0.8;
      const knotRadius065 = knotRadius * 0.65;

      for (let s = 0; s < segments; s++) {
        const angle1 = s * segmentStep + rotation;
        const angle2 = (s + 1) * segmentStep + rotation;

        const isOver = ((s & 1) ^ ((k >> 1) & 1)) === 1;
        const offsetAngle = isOver ? 0.2 : -0.2;

        ctx.beginPath();

        const x1 = this.fastCos(angle1) * knotRadius;
        const y1 = this.fastSin(angle1) * knotRadius;
        const x2 = this.fastCos(angle2) * knotRadius;
        const y2 = this.fastSin(angle2) * knotRadius;

        ctx.moveTo(x1, y1);

        const midAngle = (angle1 + angle2) * 0.5;
        const innerRadius = knotRadius065 + offsetAngle * 25;
        const xMid = this.fastCos(midAngle) * innerRadius;
        const yMid = this.fastSin(midAngle) * innerRadius;

        ctx.quadraticCurveTo(xMid, yMid, x2, y2);
        ctx.stroke();

        if ((s & 3) === 0) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(xMid, yMid, x2, y2);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (k < knots - 1) {
        const innerRadius = knotRadius * 0.5;
        ctx.strokeStyle = this.hsla(
          this.fastMod360(knotHue + 30),
          85,
          55,
          0.2 + trebleIntensity * 0.1,
        );
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, FlowFieldRenderer.TWO_PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderGermanicKnot(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0002;
    const baseRadius = 100 + ((bassIntensity * 50) | 0);
    const rotation = time * 0.3 * (bassIntensity > 0.5 ? 1 : -1);
    const pulse = 1 + this.fastSin(time * 1.5) * (audioIntensity * 0.08);
    const radius = baseRadius * pulse;

    const triHue = this.fastMod360(this.hueBase + ((time * 6) | 0));
    const twoPi3 = FlowFieldRenderer.TWO_PI / 3;
    const pi2 = Math.PI / 2;

    ctx.strokeStyle = this.hsla(triHue, 92, 70, 0.8 + audioIntensity * 0.2);
    ctx.lineWidth = 4 + bassIntensity * 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let t = 0; t < 3; t++) {
      const triRotation = t * (FlowFieldRenderer.TWO_PI / 3) + rotation;
      const triHueShift = this.fastMod360(triHue + t * 120);

      ctx.strokeStyle = this.hsla(
        triHueShift,
        92,
        70,
        0.8 + audioIntensity * 0.2,
      );

      ctx.beginPath();

      const offset = t * (twoPi3 / 3);
      for (let v = 0; v < 3; v++) {
        const angle =
          (v / 3) * FlowFieldRenderer.TWO_PI + triRotation + offset - pi2;
        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        if (v === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();

      const innerRadius = radius * 0.4;
      ctx.strokeStyle = this.hsla(
        this.fastMod360(triHueShift + 60),
        88,
        75,
        0.5 + audioIntensity * 0.25,
      );
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let v = 0; v < 3; v++) {
        const angle =
          (v / 3) * FlowFieldRenderer.TWO_PI + triRotation + offset - pi2;
        const x = this.fastCos(angle) * innerRadius;
        const y = this.fastSin(angle) * innerRadius;

        if (v === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
    }

    const centerHue = this.fastMod360(this.hueBase + 180 + ((time * 4) | 0));
    const centerRadius = 8 + ((audioIntensity * 6) | 0);
    ctx.fillStyle = this.hsla(centerHue, 95, 75, 0.8 + bassIntensity * 0.15);
    ctx.strokeStyle = this.hsla(centerHue, 92, 60, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private renderSolarFlare(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.001;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useGradients = detailScale >= 0.85;
    const useShadows = detailScale >= 0.85;
    const minDimension = Math.min(this.width, this.height);
    const baseFlareCount = 8 + ((audioIntensity * 12) | 0);
    const flareCount = Math.min(
      20,
      Math.max(4, (baseFlareCount * detailScale) | 0),
    );
    const invFlareCount = 1 / flareCount;
    const angleStep = FlowFieldRenderer.TWO_PI * invFlareCount;

    const coreRadius = 15 + bassIntensity * 25 + audioIntensity * 15;
    const maxFlareLength = minDimension * (0.4 + audioIntensity * 0.3);
    const flareWidth = (3 + trebleIntensity * 8) * detailScale;

    const coreHue = this.fastMod360(this.hueBase + time * 20);
    if (useGradients) {
      const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
      coreGradient.addColorStop(0, this.hsla(coreHue, 100, 90, 0.95));
      coreGradient.addColorStop(0.4, this.hsla(coreHue, 95, 80, 0.85));
      coreGradient.addColorStop(0.7, this.hsla(coreHue, 90, 70, 0.6));
      coreGradient.addColorStop(1, this.hsla(coreHue, 85, 60, 0.2));
      ctx.fillStyle = coreGradient;
    } else {
      ctx.fillStyle = this.hsla(coreHue, 95, 80, 0.8);
    }
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    const rotationSpeed = 0.3 + bassIntensity * 0.4;
    const baseRotation = time * rotationSpeed;
    const pulsePhase = time * 2;

    for (let i = 0; i < flareCount; i++) {
      const angle = angleStep * i + baseRotation;
      const flarePhase = i * 0.5 + pulsePhase;
      const flarePulse =
        1 + this.fastSin(flarePhase) * (0.2 + audioIntensity * 0.15);
      const flareLength =
        maxFlareLength * flarePulse * (0.7 + trebleIntensity * 0.3);

      const flareHue = this.fastMod360(
        coreHue + i * (360 * invFlareCount) + time * 15,
      );
      const flareAlpha = 0.5 + audioIntensity * 0.35 + bassIntensity * 0.15;

      if (useGradients) {
        const flareGradient = ctx.createLinearGradient(
          0,
          0,
          this.fastCos(angle) * flareLength,
          this.fastSin(angle) * flareLength,
        );

        const startColor = this.hsla(flareHue, 100, 85, flareAlpha);
        const midColor = this.hsla(flareHue, 95, 75, flareAlpha * 0.7);
        const endColor = this.hsla(flareHue, 90, 65, 0);

        flareGradient.addColorStop(0, startColor);
        flareGradient.addColorStop(0.3, midColor);
        flareGradient.addColorStop(
          0.6,
          this.hsla(flareHue, 88, 60, flareAlpha * 0.4),
        );
        flareGradient.addColorStop(1, endColor);

        ctx.strokeStyle = flareGradient;
      } else {
        ctx.strokeStyle = this.hsla(flareHue, 90, 75, flareAlpha);
      }
      ctx.lineWidth = flareWidth;
      ctx.lineCap = "round";
      ctx.shadowBlur = useShadows ? (15 + bassIntensity * 20) * detailScale : 0;
      ctx.shadowColor = this.hsla(flareHue, 100, 70, 0.8);

      ctx.beginPath();
      ctx.moveTo(
        this.fastCos(angle) * coreRadius * 0.8,
        this.fastSin(angle) * coreRadius * 0.8,
      );
      ctx.lineTo(
        this.fastCos(angle) * flareLength,
        this.fastSin(angle) * flareLength,
      );
      ctx.stroke();

      if (!lowDetail) {
        const secondaryFlareLength =
          flareLength * (0.4 + trebleIntensity * 0.2);
        const secondaryAngle = angle + this.fastSin(flarePhase * 1.3) * 0.15;
        const secondaryHue = this.fastMod360(flareHue + 30);

        ctx.strokeStyle = this.hsla(secondaryHue, 90, 70, flareAlpha * 0.5);
        ctx.lineWidth = flareWidth * 0.6;
        ctx.shadowBlur = useShadows
          ? (8 + trebleIntensity * 10) * detailScale
          : 0;
        ctx.shadowColor = this.hsla(secondaryHue, 95, 65, 0.6);

        ctx.beginPath();
        ctx.moveTo(
          this.fastCos(secondaryAngle) * coreRadius * 0.9,
          this.fastSin(secondaryAngle) * coreRadius * 0.9,
        );
        ctx.lineTo(
          this.fastCos(secondaryAngle) * secondaryFlareLength,
          this.fastSin(secondaryAngle) * secondaryFlareLength,
        );
        ctx.stroke();
      }
    }

    const coronaRadius = coreRadius * (2.5 + audioIntensity * 1.5);
    if (useGradients) {
      const coronaGradient = ctx.createRadialGradient(
        0,
        0,
        coreRadius,
        0,
        0,
        coronaRadius,
      );
      coronaGradient.addColorStop(0, this.hsla(coreHue, 100, 80, 0.4));
      coronaGradient.addColorStop(0.5, this.hsla(coreHue, 95, 70, 0.2));
      coronaGradient.addColorStop(1, this.hsla(coreHue, 90, 60, 0));
      ctx.fillStyle = coronaGradient;
    } else {
      ctx.fillStyle = this.hsla(coreHue, 90, 70, 0.2);
    }
    ctx.beginPath();
    ctx.arc(0, 0, coronaRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderTranscendence(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0005;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useGradients = detailScale >= 0.85;
    const useShadows = detailScale >= 0.85;
    const minDimension = Math.min(this.width, this.height);
    const maxHeight = this.height * 0.5;
    const baseWidth = this.width * 0.4;

    const layerCount = Math.max(
      2,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const streamCount = Math.max(
      6,
      ((12 + ((trebleIntensity * 8) | 0)) * detailScale) | 0,
    );
    const invStreamCount = 1 / streamCount;
    const angleStep = FlowFieldRenderer.TWO_PI * invStreamCount;

    const baseHue = this.fastMod360(this.hueBase + time * 5);
    const elevationSpeed = 0.02 + audioIntensity * 0.03;

    for (let layer = 0; layer < layerCount; layer++) {
      const layerProgress = layer / layerCount;
      const layerY = -maxHeight * (0.3 + layerProgress * 0.7);
      const layerTime = time + layer * 0.3;
      const layerHue = this.fastMod360(baseHue + layer * 15);
      const layerAlpha = 0.15 + audioIntensity * 0.2 - layerProgress * 0.1;
      const layerScale = 0.6 + layerProgress * 0.4;

      const streamWidth = baseWidth * layerScale;
      const streamHeight = maxHeight * (0.4 + layerProgress * 0.6);

      for (let i = 0; i < streamCount; i++) {
        const streamAngle = angleStep * i + layerTime * 0.1;
        const streamX =
          this.fastCos(streamAngle) * streamWidth * (0.3 + layerProgress * 0.7);
        const streamY =
          layerY + this.fastSin(layerTime * 2 + i * 0.5) * streamHeight * 0.1;

        const streamHue = this.fastMod360(
          layerHue +
            i * (360 * invStreamCount) +
            this.fastSin(layerTime + i) * 20,
        );

        const streamLength = streamHeight * (0.8 + audioIntensity * 0.4);
        const streamElevation =
          -streamLength * (0.5 + this.fastSin(layerTime * 3 + i) * 0.2);

        const topAlpha = layerAlpha * (0.3 + trebleIntensity * 0.4);
        const midAlpha = layerAlpha * (0.6 + audioIntensity * 0.3);
        const bottomAlpha = layerAlpha * 0.9;

        if (useGradients) {
          const streamGradient = ctx.createLinearGradient(
            streamX,
            streamY,
            streamX,
            streamY + streamElevation,
          );
          streamGradient.addColorStop(
            0,
            this.hsla(streamHue, 85, 75, topAlpha),
          );
          streamGradient.addColorStop(
            0.3,
            this.hsla(streamHue, 80, 70, midAlpha),
          );
          streamGradient.addColorStop(
            0.6,
            this.hsla(streamHue, 75, 65, bottomAlpha),
          );
          streamGradient.addColorStop(1, this.hsla(streamHue, 70, 60, 0));
          ctx.strokeStyle = streamGradient;
        } else {
          ctx.strokeStyle = this.hsla(streamHue, 80, 70, midAlpha);
        }
        ctx.lineWidth =
          (2 + bassIntensity * 3 + layerProgress * 2) * detailScale;
        ctx.lineCap = "round";
        ctx.shadowBlur = useShadows
          ? (20 + audioIntensity * 15) * detailScale
          : 0;
        ctx.shadowColor = this.hsla(streamHue, 90, 70, 0.4);

        const controlPoints = Math.max(4, (8 * detailScale) | 0);
        const pointStep = streamElevation / controlPoints;

        ctx.beginPath();
        ctx.moveTo(streamX, streamY);

        for (let p = 1; p <= controlPoints; p++) {
          const pointY = streamY + pointStep * p;
          const waveOffset =
            this.fastSin(layerTime * 2 + i * 0.7 + p * 0.8) *
            (streamWidth * 0.1);
          const pointX = streamX + waveOffset * (1 - p / controlPoints);

          if (p === 1) {
            ctx.lineTo(pointX, pointY);
          } else {
            const prevY = streamY + pointStep * (p - 1);
            const prevWaveOffset =
              this.fastSin(layerTime * 2 + i * 0.7 + (p - 1) * 0.8) *
              (streamWidth * 0.1);
            const prevX =
              streamX + prevWaveOffset * (1 - (p - 1) / controlPoints);

            const cp1x = prevX + (pointX - prevX) * 0.3;
            const cp1y = prevY + (pointY - prevY) * 0.3;
            const cp2x = prevX + (pointX - prevX) * 0.7;
            const cp2y = prevY + (pointY - prevY) * 0.7;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pointX, pointY);
          }
        }

        ctx.stroke();
      }
    }

    const centerEssenceRadius = 20 + audioIntensity * 15;
    const essenceHue = this.fastMod360(baseHue + 180);
    if (useGradients) {
      const essenceGradient = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        centerEssenceRadius,
      );
      essenceGradient.addColorStop(
        0,
        this.hsla(essenceHue, 90, 80, 0.3 + audioIntensity * 0.2),
      );
      essenceGradient.addColorStop(
        0.5,
        this.hsla(essenceHue, 85, 75, 0.15 + audioIntensity * 0.15),
      );
      essenceGradient.addColorStop(1, this.hsla(essenceHue, 80, 70, 0));
      ctx.fillStyle = essenceGradient;
    } else {
      ctx.fillStyle = this.hsla(essenceHue, 85, 78, 0.2);
    }
    ctx.beginPath();
    ctx.arc(0, 0, centerEssenceRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    const auraRadius = centerEssenceRadius * (3 + audioIntensity * 2);
    if (useGradients) {
      const auraGradient = ctx.createRadialGradient(
        0,
        0,
        centerEssenceRadius,
        0,
        0,
        auraRadius,
      );
      auraGradient.addColorStop(0, this.hsla(essenceHue, 85, 75, 0.1));
      auraGradient.addColorStop(0.4, this.hsla(essenceHue, 80, 70, 0.05));
      auraGradient.addColorStop(1, this.hsla(essenceHue, 75, 65, 0));
      ctx.fillStyle = auraGradient;
    } else {
      ctx.fillStyle = this.hsla(essenceHue, 80, 70, 0.05);
    }
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    const particleCount = Math.max(
      8,
      ((20 + ((audioIntensity * 15) | 0)) * detailScale) | 0,
    );
    for (let p = 0; p < particleCount; p++) {
      const particleAngle =
        (p / particleCount) * FlowFieldRenderer.TWO_PI + time * 0.5;
      const particleRadius =
        centerEssenceRadius + 30 + this.fastSin(time * 2 + p) * 20;
      const particleX = this.fastCos(particleAngle) * particleRadius;
      const particleY = this.fastSin(particleAngle) * particleRadius;

      const particleHue = this.fastMod360(essenceHue + p * 18);
      const particleSize = 2 + audioIntensity * 2;
      const particleAlpha = 0.4 + trebleIntensity * 0.3;

      ctx.fillStyle = this.hsla(particleHue, 90, 75, particleAlpha);
      ctx.beginPath();
      ctx.arc(particleX, particleY, particleSize, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderTreeOfLife(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useGradients = detailScale >= 0.85;
    const useShadows = detailScale >= 0.85;
    const minDimension = Math.min(this.width, this.height);
    const treeHeight = minDimension * (0.4 + audioIntensity * 0.2);
    const treeWidth = treeHeight * 0.6;
    const trunkWidth = (8 + bassIntensity * 6) * detailScale;

    const baseHue = this.fastMod360(this.hueBase + time * 3);
    const growthPulse = 1 + this.fastSin(time * 1.5) * (audioIntensity * 0.1);

    const drawBranch = (
      startX: number,
      startY: number,
      angle: number,
      length: number,
      depth: number,
      maxDepth: number,
      branchHue: number,
    ): void => {
      if (depth > maxDepth || length < 2) return;

      const endX = startX + this.fastCos(angle) * length;
      const endY = startY + this.fastSin(angle) * length;

      const branchAlpha = 0.6 - depth * 0.1 + audioIntensity * 0.2;
      const branchWidth = trunkWidth * (1 - depth * 0.3) * growthPulse;
      const currentHue = this.fastMod360(branchHue + depth * 10);

      ctx.strokeStyle = this.hsla(currentHue, 85, 70, branchAlpha);
      ctx.lineWidth = Math.max(1, branchWidth);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = useShadows ? (10 + audioIntensity * 8) * detailScale : 0;
      ctx.shadowColor = this.hsla(currentHue, 90, 75, 0.5);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (depth < maxDepth) {
        const branchAngle1 =
          angle - (Math.PI / 4) * (0.7 + trebleIntensity * 0.3);
        const branchAngle2 =
          angle + (Math.PI / 4) * (0.7 + trebleIntensity * 0.3);
        const branchLength = length * (0.65 + audioIntensity * 0.1);

        const newHue = this.fastMod360(branchHue + 15);

        drawBranch(
          endX,
          endY,
          branchAngle1,
          branchLength,
          depth + 1,
          maxDepth,
          newHue,
        );
        drawBranch(
          endX,
          endY,
          branchAngle2,
          branchLength,
          depth + 1,
          maxDepth,
          newHue,
        );
      } else {
        const leafSize = (3 + audioIntensity * 4) * detailScale;
        const leafHue = this.fastMod360(branchHue + 20);
        const leafAlpha = 0.5 + trebleIntensity * 0.3;

        ctx.fillStyle = this.hsla(leafHue, 90, 65, leafAlpha);
        ctx.beginPath();
        ctx.arc(endX, endY, leafSize, 0, FlowFieldRenderer.TWO_PI);
        ctx.fill();

        if (!lowDetail) {
          ctx.shadowBlur = useShadows ? 8 * detailScale : 0;
          ctx.shadowColor = this.hsla(leafHue, 95, 70, 0.6);
          ctx.beginPath();
          ctx.arc(endX, endY, leafSize * 0.6, 0, FlowFieldRenderer.TWO_PI);
          ctx.fill();
        }
      }
    };

    const maxDepth = Math.max(
      3,
      ((5 + ((audioIntensity * 2) | 0)) * detailScale) | 0,
    );
    const trunkLength = treeHeight * 0.4;
    const trunkAngle = -Math.PI / 2;

    ctx.shadowBlur = useShadows ? (15 + bassIntensity * 10) * detailScale : 0;
    ctx.strokeStyle = this.hsla(baseHue, 80, 60, 0.8 + bassIntensity * 0.15);
    ctx.lineWidth = trunkWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(0, treeHeight * 0.3);
    ctx.lineTo(0, treeHeight * 0.3 + trunkLength);
    ctx.stroke();

    const rootCount = Math.max(
      2,
      ((3 + ((bassIntensity * 2) | 0)) * detailScale) | 0,
    );
    for (let r = 0; r < rootCount; r++) {
      const rootAngle = Math.PI / 2 + (r - rootCount / 2) * 0.4;
      const rootLength = trunkLength * (0.4 + r * 0.15);
      const rootHue = this.fastMod360(baseHue - 20);

      ctx.strokeStyle = this.hsla(rootHue, 75, 55, 0.6 + bassIntensity * 0.2);
      ctx.lineWidth = trunkWidth * (0.6 - r * 0.1);
      ctx.shadowBlur = useShadows ? 8 * detailScale : 0;

      ctx.beginPath();
      ctx.moveTo(0, treeHeight * 0.3 + trunkLength);
      ctx.lineTo(
        this.fastCos(rootAngle) * rootLength,
        treeHeight * 0.3 + trunkLength + this.fastSin(rootAngle) * rootLength,
      );
      ctx.stroke();
    }

    const crownY = treeHeight * 0.3;
    drawBranch(0, crownY, trunkAngle, treeHeight * 0.5, 0, maxDepth, baseHue);

    const sephirothCount = Math.max(6, (10 * detailScale) | 0);
    const sephirothRadius = (12 + audioIntensity * 8) * detailScale;
    const sephirothPositions: Array<{ x: number; y: number; hue: number }> = [
      { x: 0, y: crownY - treeHeight * 0.15, hue: baseHue },
      {
        x: -treeWidth * 0.15,
        y: crownY - treeHeight * 0.05,
        hue: baseHue + 20,
      },
      { x: treeWidth * 0.15, y: crownY - treeHeight * 0.05, hue: baseHue + 40 },
      {
        x: -treeWidth * 0.25,
        y: crownY + treeHeight * 0.05,
        hue: baseHue + 60,
      },
      { x: 0, y: crownY + treeHeight * 0.1, hue: baseHue + 80 },
      {
        x: treeWidth * 0.25,
        y: crownY + treeHeight * 0.05,
        hue: baseHue + 100,
      },
      { x: -treeWidth * 0.2, y: crownY + treeHeight * 0.2, hue: baseHue + 120 },
      { x: treeWidth * 0.2, y: crownY + treeHeight * 0.2, hue: baseHue + 140 },
      { x: 0, y: crownY + treeHeight * 0.3, hue: baseHue + 160 },
      { x: 0, y: crownY + treeHeight * 0.4, hue: baseHue + 180 },
    ];

    for (
      let s = 0;
      s < Math.min(sephirothCount, sephirothPositions.length);
      s++
    ) {
      const sephiroth = sephirothPositions[s]!;
      const sephirothHue = this.fastMod360(sephiroth.hue + time * 10);
      const sephirothAlpha = 0.4 + audioIntensity * 0.3;
      const currentRadius =
        sephirothRadius * (0.8 + this.fastSin(time * 2 + s) * 0.2);

      if (useGradients) {
        const sephirothGradient = ctx.createRadialGradient(
          sephiroth.x,
          sephiroth.y,
          0,
          sephiroth.x,
          sephiroth.y,
          currentRadius,
        );
        sephirothGradient.addColorStop(
          0,
          this.hsla(sephirothHue, 100, 80, sephirothAlpha),
        );
        sephirothGradient.addColorStop(
          0.5,
          this.hsla(sephirothHue, 95, 70, sephirothAlpha * 0.6),
        );
        sephirothGradient.addColorStop(1, this.hsla(sephirothHue, 90, 60, 0));
        ctx.fillStyle = sephirothGradient;
      } else {
        ctx.fillStyle = this.hsla(sephirothHue, 95, 75, sephirothAlpha);
      }
      ctx.beginPath();
      ctx.arc(
        sephiroth.x,
        sephiroth.y,
        currentRadius,
        0,
        FlowFieldRenderer.TWO_PI,
      );
      ctx.fill();

      if (!lowDetail) {
        ctx.strokeStyle = this.hsla(sephirothHue, 95, 75, sephirothAlpha * 0.8);
        ctx.lineWidth = 2 * detailScale;
        ctx.beginPath();
        ctx.arc(
          sephiroth.x,
          sephiroth.y,
          currentRadius * 0.7,
          0,
          FlowFieldRenderer.TWO_PI,
        );
        ctx.stroke();
      }
    }

    const connectionLines: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 5],
      [3, 6],
      [5, 7],
      [6, 8],
      [7, 8],
      [8, 9],
    ];

    ctx.strokeStyle = this.hsla(baseHue, 80, 70, 0.2 + trebleIntensity * 0.2);
    ctx.lineWidth = 1.5 * detailScale;
    ctx.shadowBlur = useShadows ? 5 * detailScale : 0;

    for (const connection of connectionLines) {
      const from = connection[0];
      const to = connection[1];
      if (
        from !== undefined &&
        to !== undefined &&
        from < sephirothPositions.length &&
        to < sephirothPositions.length
      ) {
        const fromSephiroth = sephirothPositions[from];
        const toSephiroth = sephirothPositions[to];

        if (fromSephiroth && toSephiroth) {
          ctx.beginPath();
          ctx.moveTo(fromSephiroth.x, fromSephiroth.y);
          ctx.lineTo(toSephiroth.x, toSephiroth.y);
          ctx.stroke();
        }
      }
    }

    const groundY = treeHeight * 0.3 + trunkLength;
    if (useGradients) {
      const groundGradient = ctx.createLinearGradient(
        -treeWidth,
        groundY,
        treeWidth,
        groundY,
      );
      groundGradient.addColorStop(0, this.hsla(baseHue - 30, 70, 50, 0.3));
      groundGradient.addColorStop(0.5, this.hsla(baseHue - 20, 75, 55, 0.4));
      groundGradient.addColorStop(1, this.hsla(baseHue - 30, 70, 50, 0.3));
      ctx.fillStyle = groundGradient;
    } else {
      ctx.fillStyle = this.hsla(baseHue - 25, 70, 50, 0.2);
    }
    ctx.beginPath();
    ctx.ellipse(
      0,
      groundY,
      treeWidth,
      treeWidth * 0.3,
      0,
      0,
      FlowFieldRenderer.TWO_PI,
    );
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderDivineLight(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0004;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useGradients = detailScale >= 0.85;
    const useShadows = detailScale >= 0.85;
    const minDimension = Math.min(this.width, this.height);
    const maxRadius = minDimension * (0.5 + audioIntensity * 0.3);

    const baseHue = this.fastMod360(this.hueBase + time * 8);
    const divineHue = this.fastMod360(baseHue + 30);

    const centralCoreRadius = 25 + bassIntensity * 30 + audioIntensity * 20;
    if (useGradients) {
      const coreGradient = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        centralCoreRadius,
      );
      coreGradient.addColorStop(0, this.hsla(divineHue, 100, 95, 0.95));
      coreGradient.addColorStop(0.3, this.hsla(divineHue, 100, 90, 0.85));
      coreGradient.addColorStop(0.6, this.hsla(divineHue, 95, 85, 0.7));
      coreGradient.addColorStop(1, this.hsla(divineHue, 90, 80, 0.3));
      ctx.fillStyle = coreGradient;
    } else {
      ctx.fillStyle = this.hsla(divineHue, 95, 88, 0.75);
    }
    ctx.shadowBlur = useShadows ? (40 + audioIntensity * 30) * detailScale : 0;
    ctx.shadowColor = this.hsla(divineHue, 100, 90, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, centralCoreRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    const rayCount = Math.max(
      8,
      ((16 + ((audioIntensity * 12) | 0)) * detailScale) | 0,
    );
    const invRayCount = 1 / rayCount;
    const angleStep = FlowFieldRenderer.TWO_PI * invRayCount;
    const rayLength = maxRadius * (0.8 + audioIntensity * 0.3);
    const rayWidth = (4 + trebleIntensity * 8) * detailScale;

    for (let i = 0; i < rayCount; i++) {
      const angle = angleStep * i + time * 0.2;
      const rayHue = this.fastMod360(divineHue + i * (360 * invRayCount));
      const rayAlpha = 0.5 + audioIntensity * 0.35;
      const rayPulse =
        1 + this.fastSin(time * 3 + i * 0.5) * (0.15 + bassIntensity * 0.1);
      const currentRayLength = rayLength * rayPulse;

      if (useGradients) {
        const rayGradient = ctx.createLinearGradient(
          0,
          0,
          this.fastCos(angle) * currentRayLength,
          this.fastSin(angle) * currentRayLength,
        );

        rayGradient.addColorStop(0, this.hsla(rayHue, 100, 90, rayAlpha));
        rayGradient.addColorStop(
          0.4,
          this.hsla(rayHue, 95, 85, rayAlpha * 0.8),
        );
        rayGradient.addColorStop(
          0.7,
          this.hsla(rayHue, 90, 80, rayAlpha * 0.5),
        );
        rayGradient.addColorStop(1, this.hsla(rayHue, 85, 75, 0));

        ctx.strokeStyle = rayGradient;
      } else {
        ctx.strokeStyle = this.hsla(rayHue, 95, 85, rayAlpha);
      }
      ctx.lineWidth = rayWidth;
      ctx.lineCap = "round";
      ctx.shadowBlur = useShadows
        ? (25 + audioIntensity * 20) * detailScale
        : 0;
      ctx.shadowColor = this.hsla(rayHue, 100, 85, 0.7);

      ctx.beginPath();
      ctx.moveTo(
        this.fastCos(angle) * centralCoreRadius * 0.9,
        this.fastSin(angle) * centralCoreRadius * 0.9,
      );
      ctx.lineTo(
        this.fastCos(angle) * currentRayLength,
        this.fastSin(angle) * currentRayLength,
      );
      ctx.stroke();
    }

    const haloRadius = centralCoreRadius * (2.5 + audioIntensity * 1.5);
    if (useGradients) {
      const haloGradient = ctx.createRadialGradient(
        0,
        0,
        centralCoreRadius,
        0,
        0,
        haloRadius,
      );
      haloGradient.addColorStop(0, this.hsla(divineHue, 100, 90, 0.4));
      haloGradient.addColorStop(0.5, this.hsla(divineHue, 95, 85, 0.25));
      haloGradient.addColorStop(1, this.hsla(divineHue, 90, 80, 0));
      ctx.fillStyle = haloGradient;
    } else {
      ctx.fillStyle = this.hsla(divineHue, 90, 80, 0.2);
    }
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, haloRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    const lightParticleCount = Math.max(
      12,
      ((30 + ((audioIntensity * 25) | 0)) * detailScale) | 0,
    );
    const particleOrbitRadius = centralCoreRadius + 40;
    const particleSpeed = 0.5 + audioIntensity * 0.3;

    for (let p = 0; p < lightParticleCount; p++) {
      const particleAngle =
        (p / lightParticleCount) * FlowFieldRenderer.TWO_PI +
        time * particleSpeed;
      const particleOrbit =
        particleOrbitRadius + this.fastSin(time * 2 + p * 0.3) * 30;
      const particleX = this.fastCos(particleAngle) * particleOrbit;
      const particleY = this.fastSin(particleAngle) * particleOrbit;

      const particleHue = this.fastMod360(divineHue + p * 12 + time * 20);
      const particleSize = 3 + audioIntensity * 4 + trebleIntensity * 2;
      const particleAlpha = 0.6 + audioIntensity * 0.3;

      if (useGradients) {
        const particleGradient = ctx.createRadialGradient(
          particleX,
          particleY,
          0,
          particleX,
          particleY,
          particleSize,
        );
        particleGradient.addColorStop(
          0,
          this.hsla(particleHue, 100, 90, particleAlpha),
        );
        particleGradient.addColorStop(
          0.5,
          this.hsla(particleHue, 95, 85, particleAlpha * 0.6),
        );
        particleGradient.addColorStop(1, this.hsla(particleHue, 90, 80, 0));
        ctx.fillStyle = particleGradient;
      } else {
        ctx.fillStyle = this.hsla(particleHue, 95, 85, particleAlpha);
      }
      ctx.shadowBlur = useShadows
        ? (15 + audioIntensity * 10) * detailScale
        : 0;
      ctx.shadowColor = this.hsla(particleHue, 100, 85, 0.6);
      ctx.beginPath();
      ctx.arc(particleX, particleY, particleSize, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();

      if (!lowDetail) {
        const trailLength = particleSize * 2;
        const trailGradient = ctx.createLinearGradient(
          particleX - this.fastCos(particleAngle) * trailLength,
          particleY - this.fastSin(particleAngle) * trailLength,
          particleX,
          particleY,
        );
        trailGradient.addColorStop(0, this.hsla(particleHue, 90, 80, 0));
        trailGradient.addColorStop(
          1,
          this.hsla(particleHue, 95, 85, particleAlpha * 0.4),
        );

        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = particleSize * 0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(
          particleX - this.fastCos(particleAngle) * trailLength,
          particleY - this.fastSin(particleAngle) * trailLength,
        );
        ctx.lineTo(particleX, particleY);
        ctx.stroke();
      }
    }

    const cascadingLightCount = Math.max(
      3,
      ((8 + ((trebleIntensity * 6) | 0)) * detailScale) | 0,
    );
    for (let c = 0; c < cascadingLightCount; c++) {
      const cascadeAngle =
        (c / cascadingLightCount) * FlowFieldRenderer.TWO_PI + time * 0.3;
      const cascadeRadius =
        centralCoreRadius + 60 + this.fastSin(time * 1.5 + c) * 40;
      const cascadeX = this.fastCos(cascadeAngle) * cascadeRadius;
      const cascadeY = this.fastSin(cascadeAngle) * cascadeRadius;

      const cascadeHue = this.fastMod360(divineHue + c * 45);
      const cascadeSize = 8 + audioIntensity * 10;
      const cascadeAlpha = 0.4 + trebleIntensity * 0.3;

      if (useGradients) {
        const cascadeGradient = ctx.createRadialGradient(
          cascadeX,
          cascadeY,
          0,
          cascadeX,
          cascadeY,
          cascadeSize,
        );
        cascadeGradient.addColorStop(
          0,
          this.hsla(cascadeHue, 100, 88, cascadeAlpha),
        );
        cascadeGradient.addColorStop(
          0.6,
          this.hsla(cascadeHue, 95, 83, cascadeAlpha * 0.5),
        );
        cascadeGradient.addColorStop(1, this.hsla(cascadeHue, 90, 78, 0));
        ctx.fillStyle = cascadeGradient;
      } else {
        ctx.fillStyle = this.hsla(cascadeHue, 90, 80, cascadeAlpha);
      }
      ctx.shadowBlur = useShadows
        ? (20 + trebleIntensity * 15) * detailScale
        : 0;
      ctx.shadowColor = this.hsla(cascadeHue, 100, 85, 0.5);
      ctx.beginPath();
      ctx.arc(cascadeX, cascadeY, cascadeSize, 0, FlowFieldRenderer.TWO_PI);
      ctx.fill();

      if (!lowDetail) {
        const cascadeRayLength = cascadeSize * 3;
        const cascadeRayAngle = cascadeAngle + Math.PI;
        const cascadeRayGradient = ctx.createLinearGradient(
          cascadeX,
          cascadeY,
          cascadeX + this.fastCos(cascadeRayAngle) * cascadeRayLength,
          cascadeY + this.fastSin(cascadeRayAngle) * cascadeRayLength,
        );
        cascadeRayGradient.addColorStop(
          0,
          this.hsla(cascadeHue, 100, 88, cascadeAlpha * 0.6),
        );
        cascadeRayGradient.addColorStop(1, this.hsla(cascadeHue, 90, 78, 0));

        ctx.strokeStyle = cascadeRayGradient;
        ctx.lineWidth = (3 + trebleIntensity * 4) * detailScale;
        ctx.lineCap = "round";
        ctx.shadowBlur = useShadows ? 12 * detailScale : 0;
        ctx.beginPath();
        ctx.moveTo(cascadeX, cascadeY);
        ctx.lineTo(
          cascadeX + this.fastCos(cascadeRayAngle) * cascadeRayLength,
          cascadeY + this.fastSin(cascadeRayAngle) * cascadeRayLength,
        );
        ctx.stroke();
      }
    }

    const outerAuraRadius = maxRadius * 0.9;
    if (useGradients) {
      const outerAuraGradient = ctx.createRadialGradient(
        0,
        0,
        haloRadius,
        0,
        0,
        outerAuraRadius,
      );
      outerAuraGradient.addColorStop(0, this.hsla(divineHue, 90, 80, 0.15));
      outerAuraGradient.addColorStop(0.5, this.hsla(divineHue, 85, 75, 0.08));
      outerAuraGradient.addColorStop(1, this.hsla(divineHue, 80, 70, 0));
      ctx.fillStyle = outerAuraGradient;
    } else {
      ctx.fillStyle = this.hsla(divineHue, 85, 75, 0.08);
    }
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, outerAuraRadius, 0, FlowFieldRenderer.TWO_PI);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderGothicThorns(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0005;
    const pixelCount = this.width * this.height;
    const detailScale = this.getAdaptiveDetailScale(pixelCount);
    const lowDetail = detailScale < 0.85;
    const useShadows = detailScale >= 0.85;
    const minDimension = Math.min(this.width, this.height);
    const maxRadius = minDimension * (0.45 + audioIntensity * 0.25);
    const twoPi = FlowFieldRenderer.TWO_PI;

    const baseHue = this.fastMod360(this.hueBase + 200 + time * 2);
    const gothicHue = this.fastMod360(baseHue + 20);

    const centralCoreRadius = 12 + bassIntensity * 8;
    const coreGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      centralCoreRadius,
    );
    coreGradient.addColorStop(0, this.hsla(gothicHue, 85, 25, 0.9));
    coreGradient.addColorStop(0.5, this.hsla(gothicHue, 80, 20, 0.7));
    coreGradient.addColorStop(1, this.hsla(gothicHue, 75, 15, 0.4));

    ctx.fillStyle = coreGradient;
    ctx.shadowBlur = useShadows ? (20 + bassIntensity * 15) * detailScale : 0;
    ctx.shadowColor = this.hsla(gothicHue, 90, 30, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, centralCoreRadius, 0, twoPi);
    ctx.fill();

    const spikeCount = Math.max(
      6,
      ((12 + ((audioIntensity * 10) | 0)) * detailScale) | 0,
    );
    const invSpikeCount = 1 / spikeCount;
    const angleStep = twoPi * invSpikeCount;
    const baseSpikeLength = maxRadius * (0.7 + audioIntensity * 0.3);
    const spikeWidth = (3 + bassIntensity * 4) * detailScale;
    const maxSpikeDepth = lowDetail ? 1 : 2;

    const drawSpike = (
      startX: number,
      startY: number,
      angle: number,
      length: number,
      spikeHue: number,
      depth: number,
    ): void => {
      const endX = startX + this.fastCos(angle) * length;
      const endY = startY + this.fastSin(angle) * length;

      const spikeAlpha = 0.7 - depth * 0.1 + audioIntensity * 0.2;
      const currentSpikeWidth = spikeWidth * (1 - depth * 0.2);

      ctx.strokeStyle = this.hsla(spikeHue, 80, 35, spikeAlpha);
      ctx.fillStyle = this.hsla(spikeHue, 75, 30, spikeAlpha * 0.6);
      ctx.lineWidth = currentSpikeWidth;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.shadowBlur = useShadows
        ? (15 + audioIntensity * 10) * detailScale
        : 0;
      ctx.shadowColor = this.hsla(spikeHue, 85, 40, 0.5);

      const sideAngle1 = angle - Math.PI / 6;
      const sideAngle2 = angle + Math.PI / 6;
      const sideLength = length * 0.3;

      const side1X = startX + this.fastCos(sideAngle1) * sideLength;
      const side1Y = startY + this.fastSin(sideAngle1) * sideLength;
      const side2X = startX + this.fastCos(sideAngle2) * sideLength;
      const side2Y = startY + this.fastSin(sideAngle2) * sideLength;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(side1X, side1Y);
      ctx.lineTo(endX, endY);
      ctx.lineTo(side2X, side2Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (depth < maxSpikeDepth && length > 20) {
        const subSpikeLength = length * 0.4;
        const subSpikeAngle1 = angle - Math.PI / 4;
        const subSpikeAngle2 = angle + Math.PI / 4;
        const subSpikeHue = this.fastMod360(spikeHue + 10);

        drawSpike(
          side1X,
          side1Y,
          subSpikeAngle1,
          subSpikeLength,
          subSpikeHue,
          depth + 1,
        );
        drawSpike(
          side2X,
          side2Y,
          subSpikeAngle2,
          subSpikeLength,
          subSpikeHue,
          depth + 1,
        );
      }
    };

    for (let i = 0; i < spikeCount; i++) {
      const angle = angleStep * i + time * 0.3;
      const spikeHue = this.fastMod360(gothicHue + i * (360 * invSpikeCount));
      const spikePulse =
        1 + this.fastSin(time * 2 + i * 0.5) * (0.2 + bassIntensity * 0.15);
      const spikeLength = baseSpikeLength * spikePulse;

      drawSpike(0, 0, angle, spikeLength, spikeHue, 0);
    }

    const innerRingCount = Math.max(
      1,
      ((3 + ((audioIntensity * 2) | 0)) * detailScale) | 0,
    );
    for (let r = 0; r < innerRingCount; r++) {
      const ringRadius = centralCoreRadius + 20 + r * 15;
      const ringHue = this.fastMod360(gothicHue + r * 15);
      const ringAlpha = 0.4 + audioIntensity * 0.2;
      const ringRotation = time * (0.2 + r * 0.1);

      const smallSpikeCount = Math.max(4, ((8 + r * 2) * detailScale) | 0);
      const invSmallSpikeCount = 1 / smallSpikeCount;
      const smallSpikeAngleStep = twoPi * invSmallSpikeCount;
      const smallSpikeLength = 8 + bassIntensity * 6;

      for (let s = 0; s < smallSpikeCount; s++) {
        const spikeAngle = smallSpikeAngleStep * s + ringRotation;
        const spikeX = this.fastCos(spikeAngle) * ringRadius;
        const spikeY = this.fastSin(spikeAngle) * ringRadius;
        const spikeEndX = spikeX + this.fastCos(spikeAngle) * smallSpikeLength;
        const spikeEndY = spikeY + this.fastSin(spikeAngle) * smallSpikeLength;

        ctx.strokeStyle = this.hsla(ringHue, 80, 30, ringAlpha);
        ctx.lineWidth = (2 + bassIntensity * 2) * detailScale;
        ctx.lineCap = "square";
        ctx.shadowBlur = useShadows ? 8 * detailScale : 0;
        ctx.shadowColor = this.hsla(ringHue, 85, 35, 0.4);

        ctx.beginPath();
        ctx.moveTo(spikeX, spikeY);
        ctx.lineTo(spikeEndX, spikeEndY);
        ctx.stroke();
      }
    }

    const thornCount = Math.max(
      8,
      ((20 + ((trebleIntensity * 15) | 0)) * detailScale) | 0,
    );
    const invThornCount = 1 / thornCount;
    const thornAngleStep = twoPi * invThornCount;
    for (let t = 0; t < thornCount; t++) {
      const thornAngle = thornAngleStep * t + time * 0.4;
      const thornRadius =
        centralCoreRadius + 30 + this.fastSin(time * 1.5 + t * 0.4) * 25;
      const thornX = this.fastCos(thornAngle) * thornRadius;
      const thornY = this.fastSin(thornAngle) * thornRadius;

      const thornHue = this.fastMod360(gothicHue + t * 18);
      const thornLength = (6 + trebleIntensity * 8) * detailScale;
      const thornAlpha = 0.5 + trebleIntensity * 0.25;
      const thornDirection = thornAngle + Math.PI / 2;

      const thornEndX = thornX + this.fastCos(thornDirection) * thornLength;
      const thornEndY = thornY + this.fastSin(thornDirection) * thornLength;

      ctx.strokeStyle = this.hsla(thornHue, 75, 25, thornAlpha);
      ctx.fillStyle = this.hsla(thornHue, 70, 20, thornAlpha * 0.5);
      ctx.lineWidth = 2 * detailScale;
      ctx.lineCap = "square";
      ctx.shadowBlur = useShadows ? 6 * detailScale : 0;
      ctx.shadowColor = this.hsla(thornHue, 80, 30, 0.3);

      const thornSide1X =
        thornX + this.fastCos(thornDirection - Math.PI / 8) * thornLength * 0.3;
      const thornSide1Y =
        thornY + this.fastSin(thornDirection - Math.PI / 8) * thornLength * 0.3;
      const thornSide2X =
        thornX + this.fastCos(thornDirection + Math.PI / 8) * thornLength * 0.3;
      const thornSide2Y =
        thornY + this.fastSin(thornDirection + Math.PI / 8) * thornLength * 0.3;

      ctx.beginPath();
      ctx.moveTo(thornX, thornY);
      ctx.lineTo(thornSide1X, thornSide1Y);
      ctx.lineTo(thornEndX, thornEndY);
      ctx.lineTo(thornSide2X, thornSide2Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const darkAuraRadius = maxRadius * 0.85;
    if (!lowDetail) {
      const darkAuraGradient = ctx.createRadialGradient(
        0,
        0,
        centralCoreRadius,
        0,
        0,
        darkAuraRadius,
      );
      darkAuraGradient.addColorStop(0, this.hsla(gothicHue, 70, 20, 0.2));
      darkAuraGradient.addColorStop(0.5, this.hsla(gothicHue, 65, 15, 0.1));
      darkAuraGradient.addColorStop(1, this.hsla(gothicHue, 60, 10, 0));
      ctx.fillStyle = darkAuraGradient;
    } else {
      ctx.fillStyle = this.hsla(gothicHue, 65, 15, 0.12);
    }
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, darkAuraRadius, 0, twoPi);
    ctx.fill();

    const crackCount = Math.max(
      3,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const invCrackCount = 1 / crackCount;
    const crackAngleStep = twoPi * invCrackCount;
    for (let c = 0; c < crackCount; c++) {
      const crackAngle = crackAngleStep * c + time * 0.1;
      const crackLength = maxRadius * (0.3 + audioIntensity * 0.2);
      const crackHue = this.fastMod360(gothicHue - 10);
      const crackAlpha = 0.3 + bassIntensity * 0.2;

      const crackPoints = Math.max(5, (8 * detailScale) | 0);
      const invCrackPoints = 1 / crackPoints;
      ctx.strokeStyle = this.hsla(crackHue, 60, 15, crackAlpha);
      ctx.lineWidth = 1.5 * detailScale;
      ctx.lineCap = "square";
      ctx.shadowBlur = useShadows ? 5 * detailScale : 0;
      ctx.shadowColor = this.hsla(crackHue, 65, 20, 0.2);

      ctx.beginPath();
      let currentX = 0;
      let currentY = 0;
      ctx.moveTo(currentX, currentY);

      for (let p = 1; p <= crackPoints; p++) {
        const progress = p * invCrackPoints;
        const angleVariation = this.fastSin(time * 2 + c + p) * 0.2;
        const currentAngle = crackAngle + angleVariation;
        const currentLength = crackLength * progress;
        currentX = this.fastCos(currentAngle) * currentLength;
        currentY = this.fastSin(currentAngle) * currentLength;
        ctx.lineTo(currentX, currentY);
      }

      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderSacredTriangle(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0003;
    const minDimension = Math.min(this.width, this.height);
    const triangleSize = minDimension * 0.35;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const baseHue = this.fastMod360(this.hueBase + time * 5);
    const triangleHue = this.fastMod360(baseHue + 30);
    const rotation = time * 0.15;

    // Sacred geometry focus: Clear, visible triangle structure
    const angleStep = twoPi / 3;
    const angleBase = rotation - Math.PI * 0.5;
    const trianglePoints = this.sacredTrianglePoints;
    for (let i = 0; i < 3; i++) {
      const angle = angleStep * i + angleBase;
      const idx = i * 2;
      trianglePoints[idx] = this.fastCos(angle) * triangleSize;
      trianglePoints[idx + 1] = this.fastSin(angle) * triangleSize;
    }

    const p0x = trianglePoints[0]!;
    const p0y = trianglePoints[1]!;
    const p1x = trianglePoints[2]!;
    const p1y = trianglePoints[3]!;
    const p2x = trianglePoints[4]!;
    const p2y = trianglePoints[5]!;

    // Outer triangle - bold and visible
    ctx.strokeStyle = this.hsla(triangleHue, 90, 65, 0.9);
    ctx.lineWidth = 3 + bassIntensity * 2;
    ctx.lineJoin = "miter";
    ctx.shadowBlur = 8; // Subtle glow only
    ctx.shadowColor = this.hsla(triangleHue, 100, 70, 0.4);
    ctx.beginPath();
    ctx.moveTo(p0x, p0y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.closePath();
    ctx.stroke();

    // Thin fill to show triangle body
    ctx.fillStyle = this.hsla(triangleHue, 85, 55, 0.15);
    ctx.shadowBlur = 0;
    ctx.fill();

    // Inner nested triangles (sacred geometry layers)
    ctx.shadowBlur = 0;
    for (let layer = 1; layer <= 3; layer++) {
      const layerSize = triangleSize * (1 - layer * 0.2);
      const layerAlpha = 0.7 - layer * 0.15;
      const layerHue = this.fastMod360(triangleHue + layer * 15);

      ctx.strokeStyle = this.hsla(layerHue, 85, 60, layerAlpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = angleStep * i + angleBase;
        const x = this.fastCos(angle) * layerSize;
        const y = this.fastSin(angle) * layerSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Connecting lines from center to vertices (trinity symbol)
    ctx.strokeStyle = this.hsla(triangleHue, 80, 70, 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < 3; i++) {
      const idx = i * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(trianglePoints[idx]!, trianglePoints[idx + 1]!);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Sacred geometry: Inscribed circles at each vertex
    const vertexCircleRadius = triangleSize * 0.08;
    for (let i = 0; i < 3; i++) {
      const idx = i * 2;
      const vx = trianglePoints[idx]!;
      const vy = trianglePoints[idx + 1]!;
      const vertexHue = this.fastMod360(triangleHue + i * 120);

      ctx.strokeStyle = this.hsla(vertexHue, 90, 70, 0.8);
      ctx.fillStyle = this.hsla(vertexHue, 85, 60, 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(vx, vy, vertexCircleRadius, 0, twoPi);
      ctx.fill();
      ctx.stroke();
    }

    // Central symbol - Eye of Providence / All-Seeing Eye concept
    const eyeSize = triangleSize * 0.12;
    ctx.strokeStyle = this.hsla(triangleHue, 85, 75, 0.9);
    ctx.fillStyle = this.hsla(triangleHue, 90, 65, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, eyeSize, 0, twoPi);
    ctx.fill();
    ctx.stroke();

    // Pupil
    const pupilSize = eyeSize * (0.4 + audioIntensity * 0.1);
    ctx.fillStyle = this.hsla(triangleHue, 95, 50, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, pupilSize, 0, twoPi);
    ctx.fill();

    // Geometric pattern around triangle - subtle sacred geometry grid
    const gridLayers = 2;
    ctx.strokeStyle = this.hsla(triangleHue, 75, 70, 0.15);
    ctx.lineWidth = 0.5;
    for (let g = 1; g <= gridLayers; g++) {
      const gridSize = triangleSize * (1.3 + g * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, gridSize, 0, twoPi);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderEMField(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0004;
    const minDimension = Math.min(this.width, this.height);
    const maxRadius = minDimension * (0.45 + audioIntensity * 0.25);
    const twoPi = FlowFieldRenderer.TWO_PI;

    const baseHue = this.fastMod360(this.hueBase + time * 3);
    const fieldHue = this.fastMod360(baseHue + 180);

    // Firefox optimization: Drastically simplified EM field visualization

    const chargeCount = 2;
    const chargeX = this.emChargeX;
    const chargeY = this.emChargeY;
    const invChargeCount = 1 / chargeCount;

    // Simple charge positions
    for (let c = 0; c < chargeCount; c++) {
      const chargeAngle = c * invChargeCount * twoPi + time * 0.1;
      const chargeRadius = maxRadius * 0.25;
      chargeX[c] = this.fastCos(chargeAngle) * chargeRadius;
      chargeY[c] = this.fastSin(chargeAngle) * chargeRadius;
    }

    // Firefox optimization: Simple radial field lines, no physics simulation
    const fieldLineCount = 16; // Reduced from 24-40
    const invFieldLineCount = 1 / fieldLineCount;
    const lineAngleStep = twoPi * invFieldLineCount;

    ctx.lineCap = "round";
    ctx.lineWidth = 1.5 + trebleIntensity;
    ctx.shadowBlur = 0; // No shadows

    for (let i = 0; i < fieldLineCount; i++) {
      const lineAngle = lineAngleStep * i;
      const lineHue = this.fastMod360(fieldHue + i * 22.5);
      const lineAlpha = 0.4 + audioIntensity * 0.3;

      ctx.strokeStyle = this.hsla(lineHue, 85, 65, lineAlpha);

      // Simple curved line from center outward
      ctx.beginPath();
      const innerRadius = maxRadius * 0.1;
      const outerRadius = maxRadius * 1.2;

      ctx.moveTo(
        this.fastCos(lineAngle) * innerRadius,
        this.fastSin(lineAngle) * innerRadius,
      );

      // Add some curve with quadratic bezier
      const midAngle = lineAngle + this.fastSin(time * 2 + i) * 0.3;
      const midRadius = maxRadius * 0.6;
      ctx.quadraticCurveTo(
        this.fastCos(midAngle) * midRadius,
        this.fastSin(midAngle) * midRadius,
        this.fastCos(lineAngle) * outerRadius,
        this.fastSin(lineAngle) * outerRadius,
      );
      ctx.stroke();
    }

    // Simplified charges - no gradients, just simple fills
    ctx.shadowBlur = 10; // Reduced from 25+
    for (let c = 0; c < chargeCount; c++) {
      const chargeSize = 15 + bassIntensity * 8;
      const chargeHue =
        c === 0
          ? this.fastMod360(fieldHue + 30)
          : this.fastMod360(fieldHue + 210);
      const chargeAlpha = 0.8 + audioIntensity * 0.2;
      const chargePulse = 1 + this.fastSin(time * 2) * 0.15;
      const chargePosX = chargeX[c]!;
      const chargePosY = chargeY[c]!;

      ctx.fillStyle = this.hsla(chargeHue, 95, 75, chargeAlpha);
      ctx.shadowColor = this.hsla(chargeHue, 100, 80, 0.6);
      ctx.beginPath();
      ctx.arc(chargePosX, chargePosY, chargeSize * chargePulse, 0, twoPi);
      ctx.fill();

      // Single ring per charge
      ctx.strokeStyle = this.hsla(chargeHue, 90, 70, chargeAlpha * 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(chargePosX, chargePosY, chargeSize * chargePulse * 1.5, 0, twoPi);
      ctx.stroke();
    }

    // Simplified particles - no physics, just orbiting dots
    const particleCount = 12; // Reduced from 25-45
    const invParticleCount = 1 / particleCount;
    const particleAngleStep = twoPi * invParticleCount;

    ctx.shadowBlur = 0; // No particle shadows
    for (let p = 0; p < particleCount; p++) {
      const particleAngle = particleAngleStep * p + time * 0.6;
      const particleRadius = maxRadius * (0.3 + (p % 3) * 0.2);
      const particleX = this.fastCos(particleAngle) * particleRadius;
      const particleY = this.fastSin(particleAngle) * particleRadius;
      const particleHue = this.fastMod360(fieldHue + p * 30);
      const particleSize = 2.5 + trebleIntensity * 2;

      ctx.fillStyle = this.hsla(particleHue, 90, 75, 0.7);
      ctx.fillRect(
        particleX - particleSize,
        particleY - particleSize,
        particleSize * 2,
        particleSize * 2,
      );
    }

    ctx.restore();
  }

  private renderQuantumFoam(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0006;
    const minDimension = Math.min(this.width, this.height);
    const maxRadius = minDimension * (0.5 + audioIntensity * 0.3);
    const twoPi = FlowFieldRenderer.TWO_PI;
    const pixelCount = this.width * this.height;
    const baseDetailScale =
      pixelCount > 900_000 ? 0.65 : pixelCount > 700_000 ? 0.8 : 1;
    const detailScale = baseDetailScale * this.qualityScale;
    const shadowScale = detailScale;
    const lowDetail = detailScale < 0.8;
    const useShadows = detailScale >= 0.85;

    const baseHue = this.fastMod360(this.hueBase + time * 4);
    const foamHue = this.fastMod360(baseHue + 60);

    const foamCellCount = Math.max(
      12,
      ((28 + ((audioIntensity * 24) | 0)) * detailScale) | 0,
    );
    const invFoamCellCount = 1 / foamCellCount;
    const foamCellAngleStep = twoPi * invFoamCellCount;
    const cellSize = maxRadius * 0.15;

    for (let c = 0; c < foamCellCount; c++) {
      const cellAngle = foamCellAngleStep * c + time * 0.3;
      const cellRadius =
        maxRadius * (0.1 + (c % 5) * 0.1) + this.fastSin(time * 2 + c) * 20;
      const cellX = this.fastCos(cellAngle) * cellRadius;
      const cellY = this.fastSin(cellAngle) * cellRadius;

      const cellHue = this.fastMod360(foamHue + c * 9 + time * 10);
      const cellAlpha = 0.3 + audioIntensity * 0.3;
      const cellPulse =
        1 + this.fastSin(time * 3 + c * 0.5) * (0.2 + bassIntensity * 0.15);
      const currentCellSize = cellSize * cellPulse;

      if (lowDetail) {
        ctx.fillStyle = this.hsla(cellHue, 88, 65, cellAlpha);
      } else {
        const cellGradient = ctx.createRadialGradient(
          cellX,
          cellY,
          0,
          cellX,
          cellY,
          currentCellSize,
        );
        cellGradient.addColorStop(0, this.hsla(cellHue, 90, 70, cellAlpha));
        cellGradient.addColorStop(
          0.5,
          this.hsla(cellHue, 85, 65, cellAlpha * 0.6),
        );
        cellGradient.addColorStop(1, this.hsla(cellHue, 80, 60, 0));
        ctx.fillStyle = cellGradient;
      }
      ctx.shadowBlur = useShadows
        ? (12 + audioIntensity * 10) * shadowScale
        : 0;
      ctx.shadowColor = this.hsla(cellHue, 90, 75, 0.4);
      ctx.beginPath();
      ctx.arc(cellX, cellY, currentCellSize, 0, twoPi);
      ctx.fill();

      if (!lowDetail) {
        const cellRingRadius = currentCellSize * 1.2;
        ctx.strokeStyle = this.hsla(cellHue, 85, 70, cellAlpha * 0.5);
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = useShadows ? 6 * shadowScale : 0;
        ctx.beginPath();
        ctx.arc(cellX, cellY, cellRingRadius, 0, twoPi);
        ctx.stroke();
      }
    }

    const virtualParticleCount = Math.max(
      18,
      ((36 + ((audioIntensity * 28) | 0)) * detailScale) | 0,
    );
    const invVirtualParticleCount = 1 / virtualParticleCount;
    const virtualParticleAngleStep = twoPi * invVirtualParticleCount;
    for (let v = 0; v < virtualParticleCount; v++) {
      const particleLife = (v * invVirtualParticleCount + time * 0.5) % 1;
      if (particleLife < 0.3 || particleLife > 0.7) continue;

      const particleAngle = virtualParticleAngleStep * v + time * 0.4;
      const particleRadius = maxRadius * (0.2 + (v % 4) * 0.15);
      const particleX = this.fastCos(particleAngle) * particleRadius;
      const particleY = this.fastSin(particleAngle) * particleRadius;

      const particleHue = this.fastMod360(foamHue + v * 6);
      const particleSize = 1.5 + trebleIntensity * 2.5;
      const particleAlpha =
        (particleLife < 0.5 ? particleLife * 2 : (1 - particleLife) * 2) *
        (0.6 + audioIntensity * 0.3);

      ctx.fillStyle = this.hsla(particleHue, 95, 75, particleAlpha);
      ctx.shadowBlur = (8 + trebleIntensity * 6) * shadowScale;
      ctx.shadowColor = this.hsla(particleHue, 100, 80, 0.5);
      ctx.beginPath();
      ctx.arc(particleX, particleY, particleSize, 0, twoPi);
      ctx.fill();
    }

    const energyFluctuationCount = Math.max(
      3,
      ((6 + ((audioIntensity * 4) | 0)) * detailScale) | 0,
    );
    const invFluctuationCount = 1 / energyFluctuationCount;
    const fluctuationAngleStep = twoPi * invFluctuationCount;
    for (let e = 0; e < energyFluctuationCount; e++) {
      const fluctuationAngle = fluctuationAngleStep * e + time * 0.2;
      const fluctuationRadius = maxRadius * (0.15 + (e % 3) * 0.12);
      const fluctuationX = this.fastCos(fluctuationAngle) * fluctuationRadius;
      const fluctuationY = this.fastSin(fluctuationAngle) * fluctuationRadius;

      const fluctuationHue = this.fastMod360(foamHue + e * 45);
      const fluctuationSize = 6 + bassIntensity * 8;
      const fluctuationAlpha = 0.4 + bassIntensity * 0.3;
      const fluctuationPulse =
        1 + this.fastSin(time * 4 + e) * (0.3 + audioIntensity * 0.2);

      if (lowDetail) {
        ctx.fillStyle = this.hsla(fluctuationHue, 92, 70, fluctuationAlpha);
      } else {
        const fluctuationGradient = ctx.createRadialGradient(
          fluctuationX,
          fluctuationY,
          0,
          fluctuationX,
          fluctuationY,
          fluctuationSize * fluctuationPulse,
        );
        fluctuationGradient.addColorStop(
          0,
          this.hsla(fluctuationHue, 100, 80, fluctuationAlpha),
        );
        fluctuationGradient.addColorStop(
          0.6,
          this.hsla(fluctuationHue, 95, 75, fluctuationAlpha * 0.5),
        );
        fluctuationGradient.addColorStop(
          1,
          this.hsla(fluctuationHue, 90, 70, 0),
        );
        ctx.fillStyle = fluctuationGradient;
      }
      ctx.shadowBlur = useShadows ? (15 + bassIntensity * 12) * shadowScale : 0;
      ctx.shadowColor = this.hsla(fluctuationHue, 100, 85, 0.5);
      ctx.beginPath();
      ctx.arc(
        fluctuationX,
        fluctuationY,
        fluctuationSize * fluctuationPulse,
        0,
        twoPi,
      );
      ctx.fill();
    }

    const connectionCount = Math.max(
      4,
      ((8 + ((audioIntensity * 6) | 0)) * detailScale) | 0,
    );
    const invConnectionCount = 1 / connectionCount;
    const connectionAngleStep = twoPi * invConnectionCount;
    for (let conn = 0; conn < connectionCount; conn++) {
      const connAngle1 = connectionAngleStep * conn + time * 0.3;
      const connAngle2 = connectionAngleStep * (conn + 3) + time * 0.3;
      const connRadius1 = maxRadius * (0.2 + (conn % 3) * 0.1);
      const connRadius2 = maxRadius * (0.25 + ((conn + 1) % 3) * 0.1);

      const connX1 = this.fastCos(connAngle1) * connRadius1;
      const connY1 = this.fastSin(connAngle1) * connRadius1;
      const connX2 = this.fastCos(connAngle2) * connRadius2;
      const connY2 = this.fastSin(connAngle2) * connRadius2;

      const connHue = this.fastMod360(foamHue + conn * 24);
      const connAlpha = 0.2 + trebleIntensity * 0.2;
      const connDistance = this.fastSqrt(
        (connX2 - connX1) * (connX2 - connX1) +
          (connY2 - connY1) * (connY2 - connY1),
      );

      if (connDistance < maxRadius * 0.4) {
        if (lowDetail) {
          ctx.strokeStyle = this.hsla(connHue, 85, 70, connAlpha);
        } else {
          const connGradient = ctx.createLinearGradient(
            connX1,
            connY1,
            connX2,
            connY2,
          );
          connGradient.addColorStop(0, this.hsla(connHue, 85, 70, connAlpha));
          connGradient.addColorStop(
            1,
            this.hsla(connHue, 80, 65, connAlpha * 0.5),
          );
          ctx.strokeStyle = connGradient;
        }
        ctx.lineWidth = 1 + trebleIntensity * 1.5;
        ctx.lineCap = "round";
        ctx.shadowBlur = useShadows ? 5 * shadowScale : 0;
        ctx.shadowColor = this.hsla(connHue, 90, 75, 0.3);
        ctx.beginPath();
        ctx.moveTo(connX1, connY1);
        ctx.lineTo(connX2, connY2);
        ctx.stroke();
      }
    }

    const foamWaveCount = Math.max(
      1,
      ((3 + ((audioIntensity * 2) | 0)) * detailScale) | 0,
    );
    for (let fw = 0; fw < foamWaveCount; fw++) {
      const foamWaveRadius = maxRadius * (0.3 + fw * 0.15);
      const foamWaveHue = this.fastMod360(foamHue + fw * 90);
      const foamWaveAlpha = 0.15 + trebleIntensity * 0.15;
      const foamWavePhase = time * 1.5 + fw * 0.8;
      const foamWaveAmplitude = 3 + trebleIntensity * 5;

      ctx.strokeStyle = this.hsla(foamWaveHue, 80, 65, foamWaveAlpha);
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.shadowBlur = useShadows ? 4 * shadowScale : 0;
      ctx.shadowColor = this.hsla(foamWaveHue, 85, 70, 0.2);

      const foamWavePoints = lowDetail ? 32 : 48;
      const invFoamWavePoints = 1 / foamWavePoints;
      const foamWaveAngleStep = twoPi * invFoamWavePoints;
      ctx.beginPath();
      for (let fwp = 0; fwp <= foamWavePoints; fwp++) {
        const foamWaveAngle = foamWaveAngleStep * fwp;
        const foamWaveOffset =
          this.fastSin(foamWaveAngle * 4 + foamWavePhase) * foamWaveAmplitude;
        const currentFoamRadius = foamWaveRadius + foamWaveOffset;
        const foamWaveX = this.fastCos(foamWaveAngle) * currentFoamRadius;
        const foamWaveY = this.fastSin(foamWaveAngle) * currentFoamRadius;

        if (fwp === 0) {
          ctx.moveTo(foamWaveX, foamWaveY);
        } else {
          ctx.lineTo(foamWaveX, foamWaveY);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    const centralVoidRadius = 15 + audioIntensity * 10;
    const voidGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      centralVoidRadius,
    );
    voidGradient.addColorStop(0, this.hsla(foamHue, 70, 20, 0.3));
    voidGradient.addColorStop(0.5, this.hsla(foamHue, 65, 15, 0.2));
    voidGradient.addColorStop(1, this.hsla(foamHue, 60, 10, 0));

    ctx.fillStyle = voidGradient;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, centralVoidRadius, 0, twoPi);
    ctx.fill();

    const outerFoamAuraRadius = maxRadius * 0.9;
    const foamAuraGradient = ctx.createRadialGradient(
      0,
      0,
      maxRadius * 0.6,
      0,
      0,
      outerFoamAuraRadius,
    );
    foamAuraGradient.addColorStop(0, this.hsla(foamHue, 85, 65, 0.1));
    foamAuraGradient.addColorStop(1, this.hsla(foamHue, 80, 60, 0));

    ctx.fillStyle = foamAuraGradient;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, outerFoamAuraRadius, 0, twoPi);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderPrismBloom(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.001;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const minDimension = Math.min(this.width, this.height);
    const petals = 18 + ((audioIntensity * 22) | 0);
    const innerRadius = minDimension * (0.12 + bassIntensity * 0.05);
    const outerRadius = minDimension * (0.38 + audioIntensity * 0.12);
    const angleStep = twoPi / petals;
    const rotation = time * 0.7;
    const hueStep = 360 / petals;
    const alpha = 0.18 + trebleIntensity * 0.35;

    for (let i = 0; i < petals; i++) {
      const angle = i * angleStep + rotation;
      const spread =
        angleStep * (0.45 + this.fastSin(time * 1.5 + i * 0.4) * 0.08);
      const pulse = 0.6 + this.fastSin(time * 2 + i * 0.35) * 0.4;
      const radius = innerRadius + (outerRadius - innerRadius) * pulse;

      const a1 = angle - spread;
      const a2 = angle;
      const a3 = angle + spread;

      const x1 = this.fastCos(a1) * innerRadius;
      const y1 = this.fastSin(a1) * innerRadius;
      const x2 = this.fastCos(a2) * radius;
      const y2 = this.fastSin(a2) * radius;
      const x3 = this.fastCos(a3) * innerRadius;
      const y3 = this.fastSin(a3) * innerRadius;

      const hue = this.fastMod360(this.hueBase + i * hueStep + time * 60);
      ctx.fillStyle = this.hsla(hue, 92, 62, alpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
    }

    const coreRadius = innerRadius * (0.4 + bassIntensity * 0.2);
    ctx.strokeStyle = this.hsla(
      this.fastMod360(this.hueBase + time * 40),
      90,
      70,
      0.5 + trebleIntensity * 0.2,
    );
    ctx.lineWidth = 2 + trebleIntensity * 2;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, twoPi);
    ctx.stroke();

    ctx.restore();
  }

  private renderAuroraWeave(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0009;
    const bands = 5 + ((audioIntensity * 4) | 0);
    const halfWidth = this.width * 0.55;
    const segments = Math.max(60, (halfWidth / 12) | 0);
    const step = (halfWidth * 2) / segments;
    const baseAmp = 30 + bassIntensity * 70;
    const rippleAmp = 12 + midIntensity * 25;
    const shimmerAmp = 4 + audioIntensity * 10;

    for (let band = 0; band < bands; band++) {
      const bandT = bands > 1 ? band / (bands - 1) : 0.5;
      const yBase = (bandT - 0.5) * this.height * 0.7;
      const phase = time * (0.9 + bandT * 0.6) + band * 0.4;
      const hue = this.fastMod360(this.hueBase + band * 32 + time * 50);
      const alpha = 0.22 + audioIntensity * 0.25 - bandT * 0.05;

      ctx.strokeStyle = this.hsla(hue, 85, 60 + bandT * 10, alpha);
      ctx.lineWidth = 1.6 + midIntensity * 2.2 - bandT * 0.4;
      ctx.beginPath();

      for (let i = 0; i <= segments; i++) {
        const x = -halfWidth + i * step;
        const t = x / halfWidth;
        const wave =
          this.fastSin(t * 3 + phase) * baseAmp * (0.35 + bandT * 0.65);
        const ripple = this.fastSin(t * 9 - phase * 1.3) * rippleAmp;
        const shimmer = this.fastSin(t * 15 + phase * 0.7) * shimmerAmp;
        const y = yBase + wave + ripple + shimmer;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  private renderOrbitShards(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.001;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const minDimension = Math.min(this.width, this.height);
    const orbitCount = 4 + ((audioIntensity * 3) | 0);
    const baseRadius = minDimension * 0.18;
    const radiusStep = minDimension * 0.08;
    const shards = 14 + ((trebleIntensity * 16) | 0);
    const shardStep = twoPi / shards;

    for (let orbit = 0; orbit < orbitCount; orbit++) {
      const orbitRadius = baseRadius + orbit * radiusStep;
      const rotation = time * (0.6 + orbit * 0.1) * (orbit & 1 ? 1 : -1);
      const hue = this.fastMod360(this.hueBase + orbit * 45 + time * 40);
      const alpha = 0.2 + audioIntensity * 0.35 - orbit * 0.03;
      const shardSize = 5 + trebleIntensity * 5 - orbit * 0.3;

      ctx.fillStyle = this.hsla(hue, 85, 60, alpha);
      ctx.beginPath();

      for (let s = 0; s < shards; s++) {
        const angle = s * shardStep + rotation;
        const wobble =
          this.fastSin(time * 2 + s * 0.7 + orbit) * (4 + bassIntensity * 6);
        const radius = orbitRadius + wobble;

        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        const spin = angle + time * 1.3;
        const cosSpin = this.fastCos(spin);
        const sinSpin = this.fastSin(spin);
        const size = shardSize * (0.7 + this.fastSin(time * 1.6 + s) * 0.3);

        const dx = cosSpin * size;
        const dy = sinSpin * size;

        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x - dy, y + dx);
        ctx.lineTo(x - dx, y - dy);
        ctx.lineTo(x + dy, y - dx);
        ctx.closePath();
      }

      ctx.fill();
    }

    ctx.restore();
  }

  private renderHarmonicPetals(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0008;
    const twoPi = FlowFieldRenderer.TWO_PI;
    const minDimension = Math.min(this.width, this.height);
    const loops = 3 + ((audioIntensity * 2) | 0);
    const baseRadius = minDimension * 0.22;
    const points = 220;

    for (let loop = 0; loop < loops; loop++) {
      const loopT = loops > 1 ? loop / (loops - 1) : 0.5;
      const R = baseRadius * (0.8 + loop * 0.25);
      const r = R * (0.28 + loop * 0.05);
      const d = r * (1.1 + bassIntensity * 0.6);
      const ratio = (R - r) / r;
      const hue = this.fastMod360(this.hueBase + loop * 70 + time * 80);
      const alpha = 0.35 + audioIntensity * 0.25 - loopT * 0.1;

      ctx.strokeStyle = this.hsla(hue, 88, 62 + loopT * 10, alpha);
      ctx.lineWidth = 1.8 + midIntensity * 2 - loopT * 0.6;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const t = (i / points) * twoPi * 2;
        const angle = t + time * (0.8 + loopT * 0.6);
        const cosA = this.fastCos(angle);
        const sinA = this.fastSin(angle);
        const ratioAngle = angle * ratio;
        const cosR = this.fastCos(ratioAngle);
        const sinR = this.fastSin(ratioAngle);

        const x = (R - r) * cosA + d * cosR;
        const y = (R - r) * sinA - d * sinR;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  private renderLatticeDrift(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0006;
    const spacing = 24 + audioIntensity * 12;
    const halfWidth = this.width * 0.6;
    const halfHeight = this.height * 0.6;
    const lineCount = ((halfHeight / spacing) | 0) + 2;
    const baseRotation = time * 0.6;
    const lineWidth = 1.2 + trebleIntensity * 1.6;

    for (let layer = 0; layer < 2; layer++) {
      ctx.save();
      ctx.rotate(baseRotation + layer * (Math.PI * 0.5 + 0.18));

      const layerHue = this.fastMod360(this.hueBase + layer * 140 + time * 70);
      const drift = this.fastSin(time * 2 + layer) * (6 + bassIntensity * 8);

      for (let i = -lineCount; i <= lineCount; i++) {
        const offset =
          i * spacing + drift * this.fastSin(time * 1.5 + i * 0.4 + layer);
        const alpha =
          0.12 + audioIntensity * 0.2 - (Math.abs(i) / (lineCount + 1)) * 0.12;
        if (alpha <= 0) continue;

        const hue = this.fastMod360(layerHue + i * 6);
        ctx.strokeStyle = this.hsla(hue, 75, 60, alpha);
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(-halfWidth, offset);
        ctx.lineTo(halfWidth, offset);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private renderNebulaDrift(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0007;
    const minDimension = Math.min(this.width, this.height);
    const pixelCount = this.width * this.height;
    const baseDetailScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    const detailScale = baseDetailScale * this.qualityScale;
    const lowDetail = detailScale < 0.75;

    const streamCount = Math.max(
      3,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const particlesPerStream = Math.max(
      8,
      ((16 + ((midIntensity * 12) | 0)) * detailScale) | 0,
    );
    const twoPi = FlowFieldRenderer.TWO_PI;
    const baseHue = this.fastMod360(this.hueBase + time * 30);

    for (let stream = 0; stream < streamCount; stream++) {
      const streamAngle = (twoPi / streamCount) * stream + time * 0.4;
      const streamRadius =
        minDimension * (0.15 + (stream / streamCount) * 0.25);
      const streamHue = this.fastMod360(baseHue + stream * 50);
      const flowSpeed = 0.8 + stream * 0.15;

      for (let p = 0; p < particlesPerStream; p++) {
        const particleProgress =
          (p / particlesPerStream + time * flowSpeed) % 1;
        const life = 1 - Math.abs(particleProgress * 2 - 1);
        if (life < 0.1) continue;

        const angle = streamAngle + this.fastSin(time * 2 + p * 0.3) * 0.4;
        const radius =
          streamRadius +
          particleProgress * minDimension * 0.4 +
          this.fastSin(time * 1.5 + p * 0.7) * (15 + bassIntensity * 20);
        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        const size =
          (2 + audioIntensity * 3 + this.fastSin(time * 3 + p) * 1.5) * life;
        const alpha = (0.2 + audioIntensity * 0.25) * life;
        const particleHue = this.fastMod360(streamHue + particleProgress * 40);

        if (lowDetail) {
          ctx.fillStyle = this.hsla(particleHue, 85, 65, alpha);
        } else {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
          gradient.addColorStop(0, this.hsla(particleHue, 90, 70, alpha));
          gradient.addColorStop(
            0.5,
            this.hsla(particleHue, 85, 65, alpha * 0.6),
          );
          gradient.addColorStop(1, this.hsla(particleHue, 80, 60, 0));
          ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.arc(x, y, size, 0, twoPi);
        ctx.fill();
      }
    }

    const connectionsPerStream = lowDetail ? 2 : 3;
    ctx.lineWidth = 0.8 + midIntensity * 0.8;
    for (let stream = 0; stream < streamCount; stream++) {
      const streamAngle = (twoPi / streamCount) * stream + time * 0.4;
      const streamRadius =
        minDimension * (0.15 + (stream / streamCount) * 0.25);
      const streamHue = this.fastMod360(baseHue + stream * 50);

      for (let c = 0; c < connectionsPerStream; c++) {
        const progress = (c / connectionsPerStream + time * 0.6) % 1;
        const alpha =
          (0.08 + audioIntensity * 0.12) * (1 - Math.abs(progress * 2 - 1));
        if (alpha <= 0.01) continue;

        const angle = streamAngle + this.fastSin(time * 2 + c * 0.3) * 0.4;
        const radius = streamRadius + progress * minDimension * 0.4;
        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;

        const nextStream = (stream + 1) % streamCount;
        const nextAngle =
          (twoPi / streamCount) * nextStream +
          time * 0.4 +
          this.fastSin(time * 2 + c * 0.3) * 0.4;
        const nextRadius =
          minDimension * (0.15 + (nextStream / streamCount) * 0.25) +
          progress * minDimension * 0.4;
        const nx = this.fastCos(nextAngle) * nextRadius;
        const ny = this.fastSin(nextAngle) * nextRadius;

        ctx.strokeStyle = this.hsla(streamHue, 75, 60, alpha);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderCrystalPulse(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0008;
    const minDimension = Math.min(this.width, this.height);
    const pixelCount = this.width * this.height;
    const baseDetailScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    const detailScale = baseDetailScale * this.qualityScale;
    const useShadows = detailScale >= 0.85;
    const shadowScale = detailScale;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const crystalCount = Math.max(
      4,
      ((6 + ((audioIntensity * 4) | 0)) * detailScale) | 0,
    );
    const baseRotation = time * 0.5;
    const pulseScale =
      1 + this.fastSin(time * 2) * (0.12 + bassIntensity * 0.15);
    const baseHue = this.fastMod360(this.hueBase + time * 25);

    for (let crystal = 0; crystal < crystalCount; crystal++) {
      const crystalT = crystal / crystalCount;
      const crystalAngle = (twoPi / crystalCount) * crystal + baseRotation;
      const crystalRadius =
        minDimension * (0.12 + crystalT * 0.18) * pulseScale;
      const crystalSize =
        minDimension *
        (0.08 + crystalT * 0.12 + audioIntensity * 0.06) *
        pulseScale;
      const facets = 6 + ((trebleIntensity * 6) | 0);
      const facetAngle = twoPi / facets;
      const crystalHue = this.fastMod360(baseHue + crystal * 45);
      const alpha = 0.25 + audioIntensity * 0.3 - crystalT * 0.08;

      const cx = this.fastCos(crystalAngle) * crystalRadius;
      const cy = this.fastSin(crystalAngle) * crystalRadius;

      const innerRadius = crystalSize * 0.3;
      const outerRadius = crystalSize;

      ctx.fillStyle = this.hsla(crystalHue, 85, 60, alpha * 0.7);
      ctx.strokeStyle = this.hsla(crystalHue, 90, 70, alpha);
      ctx.lineWidth = 1.2 + trebleIntensity * 1.5;

      if (useShadows) {
        ctx.shadowBlur = (8 + audioIntensity * 8) * shadowScale;
        ctx.shadowColor = this.hsla(crystalHue, 90, 75, 0.5);
      }

      ctx.beginPath();
      for (let f = 0; f < facets; f++) {
        const angle = facetAngle * f + baseRotation * (1 + crystalT * 0.5);
        const outerX = cx + this.fastCos(angle) * outerRadius;
        const outerY = cy + this.fastSin(angle) * outerRadius;

        if (f === 0) {
          ctx.moveTo(outerX, outerY);
        } else {
          ctx.lineTo(outerX, outerY);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      ctx.strokeStyle = this.hsla(crystalHue, 95, 75, alpha * 0.8);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let f = 0; f < facets; f++) {
        const angle = facetAngle * f + baseRotation * (1 + crystalT * 0.5);
        const innerX = cx + this.fastCos(angle) * innerRadius;
        const innerY = cy + this.fastSin(angle) * innerRadius;
        const outerX = cx + this.fastCos(angle) * outerRadius;
        const outerY = cy + this.fastSin(angle) * outerRadius;

        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
      }
      ctx.stroke();

      const connectRadius = crystalRadius * 1.2;
      const connectX = this.fastCos(crystalAngle) * connectRadius;
      const connectY = this.fastSin(crystalAngle) * connectRadius;
      const nextCrystal = (crystal + 1) % crystalCount;
      const nextAngle = (twoPi / crystalCount) * nextCrystal + baseRotation;
      const nextConnectX = this.fastCos(nextAngle) * connectRadius;
      const nextConnectY = this.fastSin(nextAngle) * connectRadius;

      ctx.strokeStyle = this.hsla(crystalHue, 80, 65, alpha * 0.4);
      ctx.lineWidth = 0.5 + trebleIntensity * 0.8;
      ctx.beginPath();
      ctx.moveTo(connectX, connectY);
      ctx.lineTo(nextConnectX, nextConnectY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderTesseractSpin(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0006;
    const minDimension = Math.min(this.width, this.height);
    const pixelCount = this.width * this.height;
    const baseDetailScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    const detailScale = baseDetailScale * this.qualityScale;
    const useShadows = detailScale >= 0.85;
    const shadowScale = detailScale;

    const scale = minDimension * (0.15 + audioIntensity * 0.08);
    const rotationSpeed = 1 + bassIntensity * 0.5;
    const angleXY = time * rotationSpeed;
    const angleXZ = time * rotationSpeed * 0.7;
    const angleYZ = time * rotationSpeed * 0.5;
    const angleXW = time * rotationSpeed * 0.4;
    const baseHue = this.fastMod360(this.hueBase + time * 30);

    const cosXY = this.fastCos(angleXY);
    const sinXY = this.fastSin(angleXY);
    const cosXZ = this.fastCos(angleXZ);
    const sinXZ = this.fastSin(angleXZ);
    const cosYZ = this.fastCos(angleYZ);
    const sinYZ = this.fastSin(angleYZ);
    const cosXW = this.fastCos(angleXW);
    const sinXW = this.fastSin(angleXW);

    const vertices4D = [
      [-1, -1, -1, -1],
      [1, -1, -1, -1],
      [-1, 1, -1, -1],
      [1, 1, -1, -1],
      [-1, -1, 1, -1],
      [1, -1, 1, -1],
      [-1, 1, 1, -1],
      [1, 1, 1, -1],
      [-1, -1, -1, 1],
      [1, -1, -1, 1],
      [-1, 1, -1, 1],
      [1, 1, -1, 1],
      [-1, -1, 1, 1],
      [1, -1, 1, 1],
      [-1, 1, 1, 1],
      [1, 1, 1, 1],
    ];

    const vertices2D: { x: number; y: number; z: number }[] = [];
    for (const v of vertices4D) {
      const [vx = 0, vy = 0, vz = 0, vw = 0] = v ?? [];
      let x = vx;
      let y = vy;
      let z = vz;
      let w = vw;

      let temp = x * cosXW - w * sinXW;
      w = x * sinXW + w * cosXW;
      x = temp;

      temp = x * cosXY - y * sinXY;
      y = x * sinXY + y * cosXY;
      x = temp;

      temp = x * cosXZ - z * sinXZ;
      z = x * sinXZ + z * cosXZ;
      x = temp;

      temp = y * cosYZ - z * sinYZ;
      z = y * sinYZ + z * cosYZ;
      y = temp;

      const distance = 3.5;
      const perspectiveScale = distance / (distance - w);
      const projX = x * perspectiveScale * scale;
      const projY = y * perspectiveScale * scale;
      const projZ = z * perspectiveScale;

      vertices2D.push({ x: projX, y: projY, z: projZ });
    }

    const edges: Array<[number, number]> = [
      [0, 1],
      [1, 3],
      [3, 2],
      [2, 0],
      [4, 5],
      [5, 7],
      [7, 6],
      [6, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
      [8, 9],
      [9, 11],
      [11, 10],
      [10, 8],
      [12, 13],
      [13, 15],
      [15, 14],
      [14, 12],
      [8, 12],
      [9, 13],
      [10, 14],
      [11, 15],
      [0, 8],
      [1, 9],
      [2, 10],
      [3, 11],
      [4, 12],
      [5, 13],
      [6, 14],
      [7, 15],
    ];

    edges.sort((a, b) => {
      const [a0 = 0, a1 = 0] = a;
      const [b0 = 0, b1 = 0] = b;
      const zA = ((vertices2D[a0]?.z ?? 0) + (vertices2D[a1]?.z ?? 0)) * 0.5;
      const zB = ((vertices2D[b0]?.z ?? 0) + (vertices2D[b1]?.z ?? 0)) * 0.5;
      return zA - zB;
    });

    ctx.lineWidth = 1.5 + trebleIntensity * 2;
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (!edge) continue;
      const [idx1, idx2] = edge;
      if (idx1 === undefined || idx2 === undefined) continue;
      const v1 = vertices2D[idx1];
      const v2 = vertices2D[idx2];
      if (!v1 || !v2) continue;

      const avgZ = (v1.z + v2.z) * 0.5;
      const depth = (avgZ + 2) / 4;
      const alpha = 0.2 + audioIntensity * 0.4 + depth * 0.3;
      const edgeHue = this.fastMod360(baseHue + i * 8 + depth * 50);

      ctx.strokeStyle = this.hsla(edgeHue, 85, 60 + depth * 15, alpha);

      if (useShadows && depth > 0.6) {
        ctx.shadowBlur = (6 + audioIntensity * 8) * shadowScale;
        ctx.shadowColor = this.hsla(edgeHue, 90, 70, 0.4);
      }

      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.stroke();

      if (useShadows && depth > 0.6) {
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  private renderScanGrid(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.001;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const spacingScale = detailScale < 1 ? 1 / detailScale : 1;
    const spacing = (22 + audioIntensity * 12) * spacingScale;
    const halfWidth = this.width * 0.7;
    const halfHeight = this.height * 0.7;
    const lines = ((halfHeight / spacing) | 0) + 2;
    const baseRotation = time * (0.45 + bassIntensity * 0.4);
    const lineWidth = 0.9 + trebleIntensity * 1.5;
    const driftBase = 4 + bassIntensity * 12;
    const baseHue = this.fastMod360(this.hueBase + time * 110);

    for (let layer = 0; layer < 2; layer++) {
      ctx.save();
      ctx.rotate(baseRotation + layer * (Math.PI * 0.5 + 0.16));
      ctx.strokeStyle = this.hsla(
        this.fastMod360(baseHue + layer * 120),
        84,
        60 + layer * 6,
        0.16 + audioIntensity * 0.22,
      );
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      for (let i = -lines; i <= lines; i++) {
        const wobble =
          driftBase * this.fastSin(time * 1.9 + i * 0.33 + layer * 0.8);
        const y = i * spacing + wobble;
        ctx.moveTo(-halfWidth, y);
        ctx.lineTo(halfWidth, y);
      }

      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderPulseColumns(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const time = this.time * 0.024;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const columnCount = Math.max(
      16,
      ((30 + ((audioIntensity * 26) | 0)) * detailScale) | 0,
    );
    const stride = this.width / columnCount;
    const columnWidth = Math.max(2, stride * 0.72);
    const maxHeight = this.height * (0.22 + bassIntensity * 0.38);
    const baselineY = this.height * 0.88;
    const baseHue = this.fastMod360(this.hueBase + time * 30);
    const globalGain = 0.58 + audioIntensity * 0.72;

    for (let bucket = 0; bucket < 3; bucket++) {
      ctx.fillStyle = this.hsla(
        this.fastMod360(baseHue + bucket * 42),
        86,
        60 + bucket * 5,
        0.26 + audioIntensity * 0.26,
      );

      for (let i = bucket; i < columnCount; i += 3) {
        const phase = time * (1.5 + bassIntensity * 0.7) + i * 0.31;
        const overtone = time * 2.9 + i * 0.12;
        const response =
          (this.fastSin(phase) * 0.65 + this.fastSin(overtone) * 0.35 + 1) *
          0.5;
        const height =
          maxHeight * (0.18 + response * 0.82) * globalGain;
        const x = i * stride + (stride - columnWidth) * 0.5;
        const y = baselineY - height;

        ctx.fillRect(x, y, columnWidth, height);
      }
    }

    const capHeight = Math.max(1.2, 1.4 + trebleIntensity * 2.2);
    ctx.fillStyle = this.hsla(
      this.fastMod360(baseHue + 120),
      92,
      78,
      0.35 + audioIntensity * 0.28,
    );
    for (let i = 0; i < columnCount; i += 2) {
      const phase = time * (1.5 + bassIntensity * 0.7) + i * 0.31;
      const overtone = time * 2.9 + i * 0.12;
      const response =
        (this.fastSin(phase) * 0.65 + this.fastSin(overtone) * 0.35 + 1) * 0.5;
      const height = maxHeight * (0.18 + response * 0.82) * globalGain;
      const x = i * stride + (stride - columnWidth) * 0.5;
      const y = baselineY - height;
      ctx.fillRect(x, y - capHeight, columnWidth, capHeight);
    }

    ctx.restore();
  }

  private renderRadarSweep(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0012;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const twoPi = FlowFieldRenderer.TWO_PI;
    const maxRadius = Math.min(this.width, this.height) * 0.42;
    const ringCount = Math.max(
      3,
      ((6 + ((audioIntensity * 4) | 0)) * detailScale) | 0,
    );
    const spokeCount = Math.max(
      8,
      ((12 + ((midIntensity * 10) | 0)) * detailScale) | 0,
    );
    const ringStep = maxRadius / ringCount;
    const baseHue = this.fastMod360(this.hueBase + time * 90);
    const sweepAngle = time * (1.5 + bassIntensity * 0.8);
    const sweepWidth = 0.26 + bassIntensity * 0.28;

    ctx.strokeStyle = this.hsla(baseHue, 74, 56, 0.2 + audioIntensity * 0.2);
    ctx.lineWidth = 1 + midIntensity * 1.4;
    ctx.beginPath();
    for (let ring = 1; ring <= ringCount; ring++) {
      const radius = ring * ringStep;
      ctx.moveTo(radius, 0);
      ctx.arc(0, 0, radius, 0, twoPi);
    }
    ctx.stroke();

    ctx.strokeStyle = this.hsla(
      this.fastMod360(baseHue + 90),
      80,
      62,
      0.12 + audioIntensity * 0.14,
    );
    ctx.lineWidth = 0.8 + midIntensity * 0.9;
    ctx.beginPath();
    for (let spoke = 0; spoke < spokeCount; spoke++) {
      const angle = (twoPi * spoke) / spokeCount;
      const x = this.fastCos(angle) * maxRadius;
      const y = this.fastSin(angle) * maxRadius;
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = this.hsla(
      this.fastMod360(baseHue + 25),
      88,
      62,
      0.08 + audioIntensity * 0.12,
    );
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadius, sweepAngle - sweepWidth, sweepAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = this.hsla(
      this.fastMod360(baseHue + 10),
      92,
      74,
      0.38 + audioIntensity * 0.3,
    );
    ctx.lineWidth = 1.2 + midIntensity * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      this.fastCos(sweepAngle) * maxRadius,
      this.fastSin(sweepAngle) * maxRadius,
    );
    ctx.stroke();

    const nodeCount = Math.max(
      12,
      ((20 + ((midIntensity * 14) | 0)) * detailScale) | 0,
    );
    for (let node = 0; node < nodeCount; node++) {
      const ring = 1 + (node % ringCount);
      const radius = ring * ringStep;
      const angle = (twoPi * node) / nodeCount + time * 0.3;
      const wrapped =
        ((angle - sweepAngle + Math.PI * 3) % twoPi) - Math.PI;
      const visibility = Math.max(
        0,
        1 - Math.abs(wrapped) / (0.9 + bassIntensity * 0.9),
      );
      if (visibility <= 0.08) continue;

      const x = this.fastCos(angle) * radius;
      const y = this.fastSin(angle) * radius;
      const size = 1.2 + visibility * 2.4 + midIntensity * 1.3;
      ctx.fillStyle = this.hsla(
        this.fastMod360(baseHue + ring * 20),
        92,
        74,
        0.25 + visibility * 0.45,
      );
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
    }

    ctx.restore();
  }

  private renderCometTrails(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0009;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const twoPi = FlowFieldRenderer.TWO_PI;
    const cometCount = Math.max(
      14,
      ((26 + ((audioIntensity * 24) | 0)) * detailScale) | 0,
    );
    const maxRadius = Math.min(this.width, this.height) * 0.48;
    const baseHue = this.fastMod360(this.hueBase + time * 85);

    for (let bucket = 0; bucket < 3; bucket++) {
      ctx.strokeStyle = this.hsla(
        this.fastMod360(baseHue + bucket * 36),
        88,
        62 + bucket * 4,
        0.2 + audioIntensity * 0.24,
      );
      ctx.lineWidth = 0.9 + trebleIntensity * 1.5;
      ctx.beginPath();

      for (let i = bucket; i < cometCount; i += 3) {
        const t = i / cometCount;
        const orbitRadius = maxRadius * (0.2 + t * 0.8);
        const angle = t * twoPi + time * (0.9 + (i % 5) * 0.13);
        const wobble = this.fastSin(time * 2.3 + i * 0.31) * (8 + bassIntensity * 18);
        const radius = orbitRadius + wobble;
        const x = this.fastCos(angle) * radius;
        const y = this.fastSin(angle) * radius;
        const tailLength = 12 + bassIntensity * 24 + t * 9;
        const tailAngle = angle + time * 0.55;
        const tailX = x - this.fastCos(tailAngle) * tailLength;
        const tailY = y - this.fastSin(tailAngle) * tailLength;

        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);

        const head = 1.6 + trebleIntensity * 2.1 + (i % 3) * 0.45;
        ctx.fillStyle = this.hsla(
          this.fastMod360(baseHue + bucket * 36 + 18),
          95,
          74,
          0.34 + audioIntensity * 0.34,
        );
        ctx.fillRect(x - head * 0.5, y - head * 0.5, head, head);
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  private renderPhaseBands(
    audioIntensity: number,
    bassIntensity: number,
    midIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const time = this.time * 0.017;
    const detailScale = this.getAdaptiveDetailScale(this.width * this.height);
    const bandCount = Math.max(
      3,
      ((5 + ((audioIntensity * 3) | 0)) * detailScale) | 0,
    );
    const points = Math.max(72, (160 * detailScale) | 0);
    const stepX = this.width / points;
    const baseHue = this.fastMod360(this.hueBase + time * 40);
    const verticalSpacing = this.height / (bandCount + 1);

    for (let band = 0; band < bandCount; band++) {
      const yBase = verticalSpacing * (band + 1);
      const amplitude =
        (12 + bassIntensity * 34) * (1 + band * 0.08);
      const frequency = 0.72 + band * 0.24 + midIntensity * 0.95;
      const drift = time * (1 + band * 0.17);

      ctx.strokeStyle = this.hsla(
        this.fastMod360(baseHue + band * 34),
        84,
        60 + band * 4,
        0.22 + audioIntensity * 0.24,
      );
      ctx.lineWidth = 1.1 + midIntensity * 1.5;
      ctx.beginPath();

      for (let p = 0; p <= points; p++) {
        const x = p * stepX;
        const angle = p * 0.12 * frequency + drift;
        const y =
          yBase +
          this.fastSin(angle) * amplitude +
          this.fastSin(angle * 0.47 + time * 0.85) * amplitude * 0.35;

        if (p === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  private renderValknut(
    audioIntensity: number,
    bassIntensity: number,
    trebleIntensity: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.centerX, this.centerY);

    const time = this.time * 0.0007;
    const minDimension = Math.min(this.width, this.height);
    const pixelCount = this.width * this.height;
    const baseDetailScale =
      pixelCount > 900_000 ? 0.7 : pixelCount > 700_000 ? 0.85 : 1;
    const detailScale = baseDetailScale * this.qualityScale;
    const useShadows = detailScale >= 0.85;
    const shadowScale = detailScale;
    const twoPi = FlowFieldRenderer.TWO_PI;

    const mainRotation = time * 0.4;
    const pulseScale =
      1 + this.fastSin(time * 2) * (0.1 + bassIntensity * 0.12);
    const triangleSize =
      minDimension * (0.18 + audioIntensity * 0.08) * pulseScale;
    const baseHue = this.fastMod360(this.hueBase + time * 35);

    const triangleOffsets = [
      { angle: 0, distance: triangleSize * 0.38 },
      { angle: twoPi / 3, distance: triangleSize * 0.38 },
      { angle: (twoPi * 2) / 3, distance: triangleSize * 0.38 },
    ];

    for (let t = 0; t < 3; t++) {
      const offset = triangleOffsets[t];
      if (!offset) continue;

      const cx = this.fastCos(offset.angle + mainRotation) * offset.distance;
      const cy = this.fastSin(offset.angle + mainRotation) * offset.distance;

      const triangleRotation = mainRotation + t * (twoPi / 3);
      const hue = this.fastMod360(baseHue + t * 90);
      const alpha = 0.3 + audioIntensity * 0.35;

      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const angle = triangleRotation + (twoPi / 3) * i + Math.PI * 0.5;
        const x = cx + this.fastCos(angle) * triangleSize;
        const y = cy + this.fastSin(angle) * triangleSize;
        points.push({ x, y });
      }

      ctx.strokeStyle = this.hsla(hue, 90, 65, alpha);
      ctx.lineWidth = 2 + trebleIntensity * 2.5;

      if (useShadows) {
        ctx.shadowBlur = (10 + audioIntensity * 12) * shadowScale;
        ctx.shadowColor = this.hsla(hue, 95, 70, 0.5);
      }

      ctx.beginPath();
      const firstPoint = points[0];
      if (firstPoint) ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point) ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.shadowBlur = 0;

      const innerScale = 0.5 + this.fastSin(time * 2.5 + t) * 0.15;
      ctx.strokeStyle = this.hsla(hue, 95, 75, alpha * 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const innerFirstPoint = points[0];
      if (innerFirstPoint) {
        ctx.moveTo(
          cx + (innerFirstPoint.x - cx) * innerScale,
          cy + (innerFirstPoint.y - cy) * innerScale,
        );
      }
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point) {
          ctx.lineTo(
            cx + (point.x - cx) * innerScale,
            cy + (point.y - cy) * innerScale,
          );
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    const connectionAlpha = 0.12 + audioIntensity * 0.15;
    ctx.lineWidth = 0.8 + trebleIntensity * 0.8;
    for (let t = 0; t < 3; t++) {
      const offset1 = triangleOffsets[t];
      const offset2 = triangleOffsets[(t + 1) % 3];
      if (!offset1 || !offset2) continue;

      const cx1 = this.fastCos(offset1.angle + mainRotation) * offset1.distance;
      const cy1 = this.fastSin(offset1.angle + mainRotation) * offset1.distance;
      const cx2 = this.fastCos(offset2.angle + mainRotation) * offset2.distance;
      const cy2 = this.fastSin(offset2.angle + mainRotation) * offset2.distance;

      const connectionHue = this.fastMod360(baseHue + t * 60 + 45);
      ctx.strokeStyle = this.hsla(connectionHue, 80, 70, connectionAlpha);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }

    ctx.restore();
  }

  public getFractalZoom(): number {
    return this.fractalZoom;
  }

  public setFractalZoom(value: number): void {
    this.fractalZoom = Math.max(0.1, Math.min(10, value));
  }

  public getFractalOffsetX(): number {
    return this.fractalOffsetX;
  }

  public setFractalOffsetX(value: number): void {
    this.fractalOffsetX = value;
  }

  public getFractalOffsetY(): number {
    return this.fractalOffsetY;
  }

  public setFractalOffsetY(value: number): void {
    this.fractalOffsetY = value;
  }

  public getJuliaC(): { re: number; im: number } {
    return { ...this.juliaC };
  }

  public setJuliaC(re: number, im: number): void {
    this.juliaC.re = re;
    this.juliaC.im = im;
  }

  public getHueBase(): number {
    return this.hueBase;
  }

  public setHueBase(value: number): void {
    this.hueBase = value % 360;
  }

  public getPatternState(): {
    currentPattern: Pattern;
    nextPattern: Pattern;
    patternDuration: number;
    transitionSpeed: number;
    transitionProgress: number;
    isTransitioning: boolean;
    fractalZoom: number;
    fractalOffsetX: number;
    fractalOffsetY: number;
    juliaC: { re: number; im: number };
    hueBase: number;
  } {
    return {
      currentPattern: this.currentPattern,
      nextPattern: this.nextPattern,
      patternDuration: this.patternDuration,
      transitionSpeed: this.transitionSpeed,
      transitionProgress: this.transitionProgress,
      isTransitioning: this.isTransitioning,
      fractalZoom: this.fractalZoom,
      fractalOffsetX: this.fractalOffsetX,
      fractalOffsetY: this.fractalOffsetY,
      juliaC: { ...this.juliaC },
      hueBase: this.hueBase,
    };
  }

  public getAllPatterns(): Pattern[] {
    return [...this.allPatterns];
  }

  public setPattern(pattern: Pattern): void {
    if (!this.allPatterns.includes(pattern)) {
      console.warn(`Pattern "${pattern}" not found in available patterns`);
      return;
    }

    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.patternTimer = 0;

    this.currentPattern = pattern;

    const currentIndex = this.patternSequence.indexOf(pattern);
    if (currentIndex !== -1) {
      this.patternIndex = currentIndex;
      const nextIndex = (currentIndex + 1) % this.patternSequence.length;
      this.nextPattern = this.patternSequence[nextIndex] ?? "rays";
    } else {
      const allIndex = this.allPatterns.indexOf(pattern);
      const nextAllIndex = (allIndex + 1) % this.allPatterns.length;
      this.nextPattern = this.allPatterns[nextAllIndex] ?? "rays";
    }

    this.logPatternChange(this.currentPattern, "manual-selection");

    // Increment pattern counter and perform deep reset every 10 patterns
    this.patternsSinceReset++;
    if (this.patternsSinceReset >= 10) {
      this.resetCanvasState();
      this.patternsSinceReset = 0;
    }
  }

  public getParticleCount(): number {
    return this.particleCount;
  }

  public setShowFpsCounter(show: boolean): void {
    this.showFpsCounter = show;
  }

  public getPerformanceMetrics(): {
    fps: number;
    frameTime: number;
    quality: number;
  } {
    return {
      fps: Math.max(0, Math.round(1000 / Math.max(this.qualityFrameTime, 0.1))),
      frameTime: Number(this.qualityFrameTime.toFixed(2)),
      quality: Number((this.qualityScale * 100).toFixed(0)),
    };
  }

  public setParticleCount(value: number): void {
    this.particleCount = Math.max(50, Math.min(2000, value));
    this.initializeParticles();
  }

  public getParticleSize(): number {
    return this.particleSize;
  }

  public setParticleSize(value: number): void {
    this.particleSize = Math.max(0.5, Math.min(5.0, value));
  }

  public getParticleSpeed(): number {
    return this.particleSpeed;
  }

  public setParticleSpeed(value: number): void {
    this.particleSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getBubbleCount(): number {
    return this.bubbleCount;
  }

  public setBubbleCount(value: number): void {
    this.bubbleCount = Math.max(10, Math.min(100, value));
    this.initializeBubbles();
  }

  public getBubbleSize(): number {
    return this.bubbleSize;
  }

  public setBubbleSize(value: number): void {
    this.bubbleSize = Math.max(0.5, Math.min(3.0, value));
  }

  public getBubbleSpeed(): number {
    return this.bubbleSpeed;
  }

  public setBubbleSpeed(value: number): void {
    this.bubbleSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getStarCount(): number {
    return this.starCount;
  }

  public setStarCount(value: number): void {
    this.starCount = Math.max(50, Math.min(500, value));
    this.initializeStars();
  }

  public getStarSpeed(): number {
    return this.starSpeed;
  }

  public setStarSpeed(value: number): void {
    this.starSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getRayCount(): number {
    return this.rayCount;
  }

  public setRayCount(value: number): void {
    this.rayCount = Math.max(6, Math.min(72, value));
  }

  public getWaveCount(): number {
    return this.waveCount;
  }

  public setWaveCount(value: number): void {
    this.waveCount = Math.max(1, Math.min(15, value));
  }

  public getWaveAmplitude(): number {
    return this.waveAmplitude;
  }

  public setWaveAmplitude(value: number): void {
    this.waveAmplitude = Math.max(0.1, Math.min(3.0, value));
  }

  public getRingCount(): number {
    return this.ringCount;
  }

  public setRingCount(value: number): void {
    this.ringCount = Math.max(3, Math.min(30, value));
  }

  public getLightningCount(): number {
    return this.lightningCount;
  }

  public setLightningCount(value: number): void {
    this.lightningCount = Math.max(1, Math.min(10, value));
  }

  public getMatrixSpeed(): number {
    return this.matrixSpeed;
  }

  public setMatrixSpeed(value: number): void {
    this.matrixSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getTunnelSpeed(): number {
    return this.tunnelSpeed;
  }

  public setTunnelSpeed(value: number): void {
    this.tunnelSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getGalaxyArmCount(): number {
    return this.galaxyArmCount;
  }

  public setGalaxyArmCount(value: number): void {
    this.galaxyArmCount = Math.max(2, Math.min(8, value));
  }

  public getMandalaLayers(): number {
    return this.mandalaLayers;
  }

  public setMandalaLayers(value: number): void {
    this.mandalaLayers = Math.max(1, Math.min(12, value));
  }

  public getTarotCardSize(): number {
    return this.tarotCardSize;
  }

  public setTarotCardSize(value: number): void {
    this.tarotCardSize = Math.max(0.5, Math.min(3.0, value));
  }

  public getTarotCardCount(): number {
    return this.tarotCardCount;
  }

  public setTarotCardCount(value: number): void {
    this.tarotCardCount = Math.max(3, Math.min(22, value));
  }

  public getSacredSpiralCount(): number {
    return this.sacredSpiralCount;
  }

  public setSacredSpiralCount(value: number): void {
    this.sacredSpiralCount = Math.max(1, Math.min(8, value));
  }

  public getSacredSpiralTightness(): number {
    return this.sacredSpiralTightness;
  }

  public setSacredSpiralTightness(value: number): void {
    this.sacredSpiralTightness = Math.max(0.1, Math.min(3.0, value));
  }

  public getPentagramSize(): number {
    return this.pentagramSize;
  }

  public setPentagramSize(value: number): void {
    this.pentagramSize = Math.max(0.5, Math.min(2.0, value));
  }

  public getPentagramRotationSpeed(): number {
    return this.pentagramRotationSpeed;
  }

  public setPentagramRotationSpeed(value: number): void {
    this.pentagramRotationSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getRuneSize(): number {
    return this.runeSize;
  }

  public setRuneSize(value: number): void {
    this.runeSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getRuneCount(): number {
    return this.runeCount;
  }

  public setRuneCount(value: number): void {
    this.runeCount = Math.max(4, Math.min(16, value));
  }

  public getSigilCount(): number {
    return this.sigilCount;
  }

  public setSigilCount(value: number): void {
    this.sigilCount = Math.max(3, Math.min(12, value));
  }

  public getSigilSize(): number {
    return this.sigilSize;
  }

  public setSigilSize(value: number): void {
    this.sigilSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getChakraSize(): number {
    return this.chakraSize;
  }

  public setChakraSize(value: number): void {
    this.chakraSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getChakraSpacing(): number {
    return this.chakraSpacing;
  }

  public setChakraSpacing(value: number): void {
    this.chakraSpacing = Math.max(0.5, Math.min(2.0, value));
  }

  public getPortalSize(): number {
    return this.portalSize;
  }

  public setPortalSize(value: number): void {
    this.portalSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getPortalRingCount(): number {
    return this.portalRingCount;
  }

  public setPortalRingCount(value: number): void {
    this.portalRingCount = Math.max(3, Math.min(12, value));
  }

  public getPhoenixWingSpan(): number {
    return this.phoenixWingSpan;
  }

  public setPhoenixWingSpan(value: number): void {
    this.phoenixWingSpan = Math.max(0.5, Math.min(2.5, value));
  }

  public getCrystalGridSize(): number {
    return this.crystalGridSize;
  }

  public setCrystalGridSize(value: number): void {
    this.crystalGridSize = Math.max(0.5, Math.min(2.0, value));
  }

  public getCrystalCount(): number {
    return this.crystalCount;
  }

  public setCrystalCount(value: number): void {
    this.crystalCount = Math.max(6, Math.min(24, value));
  }

  public getMoonPhaseCount(): number {
    return this.moonPhaseCount;
  }

  public setMoonPhaseCount(value: number): void {
    this.moonPhaseCount = Math.max(4, Math.min(13, value));
  }

  public getMoonPhaseSize(): number {
    return this.moonPhaseSize;
  }

  public setMoonPhaseSize(value: number): void {
    this.moonPhaseSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getFlowerOfLifeCircleCount(): number {
    return this.flowerOfLifeCircleCount;
  }

  public setFlowerOfLifeCircleCount(value: number): void {
    this.flowerOfLifeCircleCount = Math.max(1, Math.min(19, value));
  }

  public getFlowerOfLifeSize(): number {
    return this.flowerOfLifeSize;
  }

  public setFlowerOfLifeSize(value: number): void {
    this.flowerOfLifeSize = Math.max(0.5, Math.min(2.0, value));
  }

  public getMetatronNodeCount(): number {
    return this.metatronNodeCount;
  }

  public setMetatronNodeCount(value: number): void {
    this.metatronNodeCount = Math.max(7, Math.min(19, value));
  }

  public getMetatronSize(): number {
    return this.metatronSize;
  }

  public setMetatronSize(value: number): void {
    this.metatronSize = Math.max(0.5, Math.min(2.0, value));
  }

  public getTorusRingCount(): number {
    return this.torusRingCount;
  }

  public setTorusRingCount(value: number): void {
    this.torusRingCount = Math.max(6, Math.min(24, value));
  }

  public getTorusThickness(): number {
    return this.torusThickness;
  }

  public setTorusThickness(value: number): void {
    this.torusThickness = Math.max(0.3, Math.min(2.0, value));
  }

  public getLabyrinthComplexity(): number {
    return this.labyrinthComplexity;
  }

  public setLabyrinthComplexity(value: number): void {
    this.labyrinthComplexity = Math.max(0.5, Math.min(2.5, value));
  }

  public getLabyrinthPathWidth(): number {
    return this.labyrinthPathWidth;
  }

  public setLabyrinthPathWidth(value: number): void {
    this.labyrinthPathWidth = Math.max(0.5, Math.min(2.0, value));
  }

  public getVortexSpiralCount(): number {
    return this.vortexSpiralCount;
  }

  public setVortexSpiralCount(value: number): void {
    this.vortexSpiralCount = Math.max(2, Math.min(12, value));
  }

  public getVortexRotationSpeed(): number {
    return this.vortexRotationSpeed;
  }

  public setVortexRotationSpeed(value: number): void {
    this.vortexRotationSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getDragonEyeSize(): number {
    return this.dragonEyeSize;
  }

  public setDragonEyeSize(value: number): void {
    this.dragonEyeSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getDragonPupilSize(): number {
    return this.dragonPupilSize;
  }

  public setDragonPupilSize(value: number): void {
    this.dragonPupilSize = Math.max(0.3, Math.min(1.5, value));
  }

  public getAncientGlyphCount(): number {
    return this.ancientGlyphCount;
  }

  public setAncientGlyphCount(value: number): void {
    this.ancientGlyphCount = Math.max(8, Math.min(32, value));
  }

  public getAncientGlyphSize(): number {
    return this.ancientGlyphSize;
  }

  public setAncientGlyphSize(value: number): void {
    this.ancientGlyphSize = Math.max(0.5, Math.min(2.5, value));
  }

  public getPlatonicSize(): number {
    return this.platonicSize;
  }

  public setPlatonicSize(value: number): void {
    this.platonicSize = Math.max(0.5, Math.min(2.0, value));
  }

  public getPlatonicRotationSpeed(): number {
    return this.platonicRotationSpeed;
  }

  public setPlatonicRotationSpeed(value: number): void {
    this.platonicRotationSpeed = Math.max(0.1, Math.min(3.0, value));
  }

  public getCosmicLotusLayerCount(): number {
    return this.cosmicLotusLayerCount;
  }

  public setCosmicLotusLayerCount(value: number): void {
    this.cosmicLotusLayerCount = Math.max(2, Math.min(12, value));
  }

  public getCosmicLotusPetalCount(): number {
    return this.cosmicLotusPetalCount;
  }

  public setCosmicLotusPetalCount(value: number): void {
    this.cosmicLotusPetalCount = Math.max(4, Math.min(16, value));
  }

  public getKaleidoscopeSegments(): number {
    return this.kaleidoscopeSegments;
  }

  public setKaleidoscopeSegments(value: number): void {
    this.kaleidoscopeSegments = Math.max(3, Math.min(48, value));
  }

  public getKaleidoscopeRotationSpeed(): number {
    return this.kaleidoscopeRotationSpeed;
  }

  public setKaleidoscopeRotationSpeed(value: number): void {
    this.kaleidoscopeRotationSpeed = Math.max(0.1, Math.min(5.0, value));
  }

  public getKaleidoscopeParticleDensity(): number {
    return this.kaleidoscopeParticleDensity;
  }

  public setKaleidoscopeParticleDensity(value: number): void {
    this.kaleidoscopeParticleDensity = Math.max(0.1, Math.min(3.0, value));
  }

  public getKaleidoscopeColorShift(): number {
    return this.kaleidoscopeColorShift;
  }

  public setKaleidoscopeColorShift(value: number): void {
    this.kaleidoscopeColorShift = Math.max(0.0, Math.min(3.0, value));
  }
}
