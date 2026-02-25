// File: packages/visualizers/src/FlowFieldCanvas.tsx

"use client";

import {
  ensureConnectionChain,
  getOrCreateAudioConnection,
} from "@starchild/audio-adapters/web/audioContextManager";
import { useEffect, useRef } from "react";
import { FlowFieldRenderer } from "./FlowFieldRenderer";
import type { Pattern } from "./flowfieldPatterns/patternIds";

interface FlowFieldCanvasProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  visualizerMode?: "random" | "off" | "specific";
  visualizerType?: string;
  showFpsCounter?: boolean;
  className?: string;
}

const VALID_PATTERNS = new Set<string>([
  "kaleidoscope",
  "fractal",
  "rays",
  "tunnel",
  "bubbles",
  "waves",
  "swarm",
  "mandala",
  "dna",
  "galaxy",
  "matrix",
  "lightning",
  "fireworks",
  "lissajous",
  "rings",
  "starfield",
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
]);

export function FlowFieldCanvas({
  audioElement,
  isPlaying,
  visualizerMode = "random",
  visualizerType = "flowfield",
  showFpsCounter = false,
  className,
}: FlowFieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlowFieldRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedAudioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioElement) {
      sourceNodeRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
      connectedAudioElementRef.current = null;
      return;
    }

    const connection = getOrCreateAudioConnection(audioElement);
    if (!connection) {
      sourceNodeRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
      connectedAudioElementRef.current = null;
      return;
    }

    let analyser = connection.analyser;
    if (!analyser) {
      analyser = connection.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      connection.analyser = analyser;
    }

    audioContextRef.current = connection.audioContext;
    analyserRef.current = analyser;
    sourceNodeRef.current = connection.sourceNode;
    connectedAudioElementRef.current = audioElement;

    ensureConnectionChain(connection);

    return () => {
      sourceNodeRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
      connectedAudioElementRef.current = null;
    };
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = w;
      canvas.height = h;

      if (rendererRef.current) {
        rendererRef.current.resize(w, h);
      } else {
        rendererRef.current = new FlowFieldRenderer(canvas);
        if (
          visualizerMode === "specific" &&
          visualizerType &&
          visualizerType !== "flowfield" &&
          VALID_PATTERNS.has(visualizerType)
        ) {
          rendererRef.current.setPattern(visualizerType as Pattern);
        }
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      rendererRef.current = null;
    };
  }, [visualizerMode, visualizerType]);

  useEffect(() => {
    rendererRef.current?.setShowFpsCounter(showFpsCounter);
  }, [showFpsCounter]);

  useEffect(() => {
    if (
      visualizerMode === "specific" &&
      visualizerType &&
      visualizerType !== "flowfield" &&
      VALID_PATTERNS.has(visualizerType) &&
      rendererRef.current
    ) {
      rendererRef.current.setPattern(visualizerType as Pattern);
    }
  }, [visualizerMode, visualizerType]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !rendererRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const analyser = analyserRef.current;
    const renderer = rendererRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      renderer.render(dataArray, dataArray.length);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (audioContextRef.current?.state === "suspended") {
      void audioContextRef.current.resume();
    }

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  return (
    <div ref={containerRef} className={className ?? "h-full w-full"}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
