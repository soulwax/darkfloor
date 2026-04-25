// File: apps/web/src/components/FlowFieldBackground.tsx

"use client";

import {
  ensureConnectionChain,
  getOrCreateAudioConnection,
  releaseAudioConnection,
} from "@starchild/audio-adapters/web/audioContextManager";
import type { VisualizerFidelity } from "@starchild/types/settings";
import { useEffect, useRef, useState } from "react";
import { getVisualizerResolutionScale } from "@starchild/visualizers/browser";
import { FlowFieldRenderer } from "@starchild/visualizers/FlowFieldRenderer";

interface FlowFieldBackgroundProps {
  audioElement: HTMLAudioElement | null;
  visualizerFidelity?: VisualizerFidelity;
  showFpsCounter?: boolean;
  onRendererReady?: (renderer: FlowFieldRenderer | null) => void;
  allowPointerInteraction?: boolean;
  onCanvasClick?: () => void;
}

export function FlowFieldBackground({
  audioElement,
  visualizerFidelity = "balanced",
  showFpsCounter = false,
  onRendererReady,
  allowPointerInteraction = false,
  onCanvasClick,
}: FlowFieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlowFieldRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Sync playing state with audio element - intentional event subscription
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync from audio element events */
  useEffect(() => {
    if (!audioElement) {
      setIsPlaying(false);
      return;
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    setIsPlaying(!audioElement.paused);

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
    };
  }, [audioElement]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!audioElement) {
      if (connectedAudioElementRef.current) {
        releaseAudioConnection(connectedAudioElementRef.current);
      }
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
      // Don't release the audio connection on cleanup - it's managed by the audioContextManager
      // and should persist across component unmounts to avoid interrupting playback.
      // The connection will be cleaned up when the audio element itself is removed.
      // We only need to clear our local references.
      sourceNodeRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
      connectedAudioElementRef.current = null;
    };
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const resolutionScale = getVisualizerResolutionScale(visualizerFidelity);
      const renderWidth = Math.max(
        1,
        Math.round(window.innerWidth * resolutionScale),
      );
      const renderHeight = Math.max(
        1,
        Math.round(window.innerHeight * resolutionScale),
      );

      canvas.width = renderWidth;
      canvas.height = renderHeight;

      if (rendererRef.current) {
        rendererRef.current.resize(renderWidth, renderHeight);
      } else {
        rendererRef.current = new FlowFieldRenderer(canvas);
      }
      onRendererReady?.(rendererRef.current);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
      onRendererReady?.(null);
      rendererRef.current = null;
    };
  }, [onRendererReady, visualizerFidelity]);

  useEffect(() => {
    rendererRef.current?.setShowFpsCounter(showFpsCounter);
  }, [showFpsCounter]);

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
    <canvas
      ref={canvasRef}
      onClick={allowPointerInteraction ? onCanvasClick : undefined}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: allowPointerInteraction ? 49 : -1,
        pointerEvents: allowPointerInteraction ? "auto" : "none",
        contain: "paint",
        backfaceVisibility: "hidden",
        opacity: 0.78,
        filter: "contrast(1.18) saturate(1.38)",
        mixBlendMode: "normal",
      }}
    />
  );
}
