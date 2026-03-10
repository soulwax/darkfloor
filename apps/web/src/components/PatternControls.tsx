// File: apps/web/src/components/PatternControls.tsx

"use client";

import { ChevronDown, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FlowFieldRenderer } from "@starchild/visualizers/FlowFieldRenderer";
import type { Pattern } from "@starchild/visualizers/flowfieldPatterns/patternIds";

interface PatternControlsProps {
  renderer: FlowFieldRenderer | null;
  onClose: () => void;
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (value: number) => void;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  decimals = 0,
  onChange,
}: SliderControlProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm text-[var(--color-subtext)]">{label}</label>
        <span className="font-mono text-xs text-[var(--color-accent)]">
          {value.toFixed(decimals)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
      />
    </div>
  );
}

export default function PatternControls({
  renderer,
  onClose,
}: PatternControlsProps) {
  const t = useTranslations("patterns");
  const [patternState, setPatternState] = useState<{
    currentPattern: string;
    nextPattern: string;
    patternDuration: number;
    transitionSpeed: number;
    transitionProgress: number;
    isTransitioning: boolean;
    fractalZoom: number;
    fractalOffsetX: number;
    fractalOffsetY: number;
    juliaC: { re: number; im: number };
    hueBase: number;
  } | null>(null);
  const [rawCurrentPattern, setRawCurrentPattern] = useState<string>("");

  const sectionTitleMap = useMemo<Record<string, string>>(
    () => ({
      fractal: t("sections.fractal"),
      rays: t("sections.rays"),
      waves: t("sections.waves"),
      swarm: t("sections.particles"),
      fluid: t("sections.particles"),
      bubbles: t("sections.bubbles"),
      starfield: t("sections.starfield"),
      rings: t("sections.rings"),
      tunnel: t("sections.tunnel"),
      matrix: t("sections.matrix"),
      lightning: t("sections.lightning"),
      galaxy: t("sections.galaxy"),
      mandala: t("sections.mandala"),
      tarot: t("sections.tarot"),
      sacredSpiral: t("sections.sacredSpiral"),
      pentagram: t("sections.pentagram"),
      runes: t("sections.runes"),
      sigils: t("sections.sigils"),
      chakras: t("sections.chakras"),
      portal: t("sections.portal"),
      phoenix: t("sections.phoenix"),
      crystalGrid: t("sections.crystalGrid"),
      moonPhases: t("sections.moonPhases"),
      flowerOfLife: t("sections.flowerOfLife"),
      metatron: t("sections.metatron"),
      torusField: t("sections.torusField"),
      labyrinth: t("sections.labyrinth"),
      vortexSpiral: t("sections.vortexSpiral"),
      dragonEye: t("sections.dragonEye"),
      ancientGlyphs: t("sections.ancientGlyphs"),
      platonic: t("sections.platonic"),
      cosmicLotus: t("sections.cosmicLotus"),
      kaleidoscope: t("sections.kaleidoscope"),
    }),
    [t],
  );

  const availablePatterns = useMemo(
    () => (renderer ? renderer.getAllPatterns() : []),
    [renderer],
  );

  const getPatternName = useCallback(
    (pattern: string) =>
      sectionTitleMap[pattern] ??
      renderer?.getFormattedPatternName(pattern as Pattern) ??
      pattern,
    [renderer, sectionTitleMap],
  );

  const [patternParams, setPatternParams] = useState<{
    particleCount: number;
    particleSize: number;
    particleSpeed: number;
    bubbleCount: number;
    bubbleSize: number;
    bubbleSpeed: number;
    starCount: number;
    starSpeed: number;
    rayCount: number;
    waveCount: number;
    waveAmplitude: number;
    ringCount: number;
    lightningCount: number;
    matrixSpeed: number;
    tunnelSpeed: number;
    galaxyArmCount: number;
    mandalaLayers: number;
    tarotCardSize: number;
    tarotCardCount: number;
    sacredSpiralCount: number;
    sacredSpiralTightness: number;
    pentagramSize: number;
    pentagramRotationSpeed: number;
    runeSize: number;
    runeCount: number;
    sigilCount: number;
    sigilSize: number;
    chakraSize: number;
    chakraSpacing: number;
    portalSize: number;
    portalRingCount: number;
    phoenixWingSpan: number;
    crystalGridSize: number;
    crystalCount: number;
    moonPhaseCount: number;
    moonPhaseSize: number;
    flowerOfLifeCircleCount: number;
    flowerOfLifeSize: number;
    metatronNodeCount: number;
    metatronSize: number;
    torusRingCount: number;
    torusThickness: number;
    labyrinthComplexity: number;
    labyrinthPathWidth: number;
    vortexSpiralCount: number;
    vortexRotationSpeed: number;
    dragonEyeSize: number;
    dragonPupilSize: number;
    ancientGlyphCount: number;
    ancientGlyphSize: number;
    platonicSize: number;
    platonicRotationSpeed: number;
    cosmicLotusLayerCount: number;
    cosmicLotusPetalCount: number;
    kaleidoscopeSegments: number;
    kaleidoscopeRotationSpeed: number;
    kaleidoscopeParticleDensity: number;
    kaleidoscopeColorShift: number;
  } | null>(null);

  useEffect(() => {
    if (!renderer) return;

    const updateState = () => {
      const state = renderer.getPatternState();
      setRawCurrentPattern(state.currentPattern);
      setPatternState({
        currentPattern: getPatternName(state.currentPattern),
        nextPattern: getPatternName(state.nextPattern),
        patternDuration: state.patternDuration,
        transitionSpeed: state.transitionSpeed,
        transitionProgress: state.transitionProgress,
        isTransitioning: state.isTransitioning,
        fractalZoom: state.fractalZoom,
        fractalOffsetX: state.fractalOffsetX,
        fractalOffsetY: state.fractalOffsetY,
        juliaC: state.juliaC,
        hueBase: state.hueBase,
      });

      setPatternParams({
        particleCount: renderer.getParticleCount(),
        particleSize: renderer.getParticleSize(),
        particleSpeed: renderer.getParticleSpeed(),
        bubbleCount: renderer.getBubbleCount(),
        bubbleSize: renderer.getBubbleSize(),
        bubbleSpeed: renderer.getBubbleSpeed(),
        starCount: renderer.getStarCount(),
        starSpeed: renderer.getStarSpeed(),
        rayCount: renderer.getRayCount(),
        waveCount: renderer.getWaveCount(),
        waveAmplitude: renderer.getWaveAmplitude(),
        ringCount: renderer.getRingCount(),
        lightningCount: renderer.getLightningCount(),
        matrixSpeed: renderer.getMatrixSpeed(),
        tunnelSpeed: renderer.getTunnelSpeed(),
        galaxyArmCount: renderer.getGalaxyArmCount(),
        mandalaLayers: renderer.getMandalaLayers(),
        tarotCardSize: renderer.getTarotCardSize(),
        tarotCardCount: renderer.getTarotCardCount(),
        sacredSpiralCount: renderer.getSacredSpiralCount(),
        sacredSpiralTightness: renderer.getSacredSpiralTightness(),
        pentagramSize: renderer.getPentagramSize(),
        pentagramRotationSpeed: renderer.getPentagramRotationSpeed(),
        runeSize: renderer.getRuneSize(),
        runeCount: renderer.getRuneCount(),
        sigilCount: renderer.getSigilCount(),
        sigilSize: renderer.getSigilSize(),
        chakraSize: renderer.getChakraSize(),
        chakraSpacing: renderer.getChakraSpacing(),
        portalSize: renderer.getPortalSize(),
        portalRingCount: renderer.getPortalRingCount(),
        phoenixWingSpan: renderer.getPhoenixWingSpan(),
        crystalGridSize: renderer.getCrystalGridSize(),
        crystalCount: renderer.getCrystalCount(),
        moonPhaseCount: renderer.getMoonPhaseCount(),
        moonPhaseSize: renderer.getMoonPhaseSize(),
        flowerOfLifeCircleCount: renderer.getFlowerOfLifeCircleCount(),
        flowerOfLifeSize: renderer.getFlowerOfLifeSize(),
        metatronNodeCount: renderer.getMetatronNodeCount(),
        metatronSize: renderer.getMetatronSize(),
        torusRingCount: renderer.getTorusRingCount(),
        torusThickness: renderer.getTorusThickness(),
        labyrinthComplexity: renderer.getLabyrinthComplexity(),
        labyrinthPathWidth: renderer.getLabyrinthPathWidth(),
        vortexSpiralCount: renderer.getVortexSpiralCount(),
        vortexRotationSpeed: renderer.getVortexRotationSpeed(),
        dragonEyeSize: renderer.getDragonEyeSize(),
        dragonPupilSize: renderer.getDragonPupilSize(),
        ancientGlyphCount: renderer.getAncientGlyphCount(),
        ancientGlyphSize: renderer.getAncientGlyphSize(),
        platonicSize: renderer.getPlatonicSize(),
        platonicRotationSpeed: renderer.getPlatonicRotationSpeed(),
        cosmicLotusLayerCount: renderer.getCosmicLotusLayerCount(),
        cosmicLotusPetalCount: renderer.getCosmicLotusPetalCount(),
        kaleidoscopeSegments: renderer.getKaleidoscopeSegments(),
        kaleidoscopeRotationSpeed: renderer.getKaleidoscopeRotationSpeed(),
        kaleidoscopeParticleDensity: renderer.getKaleidoscopeParticleDensity(),
        kaleidoscopeColorShift: renderer.getKaleidoscopeColorShift(),
      });
    };

    updateState();
    const interval = setInterval(updateState, 500);

    return () => clearInterval(interval);
  }, [getPatternName, renderer, t]);

  if (!renderer || !patternState || !patternParams) {
    return null;
  }

  return (
    <>
      {}
      <div
        className="theme-chrome-backdrop fixed inset-0 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {}
      <div className="theme-chrome-drawer fixed bottom-24 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border shadow-2xl backdrop-blur-xl">
        {}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="font-semibold text-[var(--color-text)]">
              {t("title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-[var(--color-subtext)] transition hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)]"
          >
            {t("close")}
          </button>
        </div>

        {}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              {t("selectPattern")}
            </label>
            <div className="relative">
              <select
                value={rawCurrentPattern}
                onChange={(e) => {
                  renderer.setPattern(e.target.value as Pattern);
                }}
                className="theme-input w-full appearance-none rounded-lg px-4 py-2.5 pr-10 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)] focus:border-[var(--color-accent)] focus:outline-none"
              >
                {availablePatterns.map((pattern) => (
                  <option key={pattern} value={pattern}>
                    {getPatternName(pattern)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[var(--color-accent)]" />
            </div>
            {patternState.isTransitioning && (
              <div className="mt-2 text-xs text-[var(--color-subtext)]">
                {t("transitioningTo", {
                  pattern: patternState.nextPattern,
                  progress: Math.round(patternState.transitionProgress * 100),
                })}
              </div>
            )}
          </div>

          {}
          <div className="mb-6 space-y-4">
            <h4 className="text-sm font-semibold text-[var(--color-text)]">
              {t("sections.general")}
            </h4>

            <SliderControl
              label={t("labels.patternDuration")}
              value={patternState.patternDuration}
              min={10}
              max={10000}
              step={10}
              decimals={0}
              onChange={(value) => {
                renderer.setPatternDuration(value);
                setPatternState((prev) =>
                  prev ? { ...prev, patternDuration: value } : null,
                );
              }}
            />

            <SliderControl
              label={t("labels.transitionSpeed")}
              value={patternState.transitionSpeed}
              min={0.001}
              max={0.1}
              step={0.001}
              decimals={3}
              onChange={(value) => {
                renderer.setTransitionSpeed(value);
                setPatternState((prev) =>
                  prev ? { ...prev, transitionSpeed: value } : null,
                );
              }}
            />

            <SliderControl
              label={t("labels.hueBase")}
              value={patternState.hueBase}
              min={0}
              max={360}
              step={1}
              unit="°"
              decimals={0}
              onChange={(value) => {
                renderer.setHueBase(value);
                setPatternState((prev) =>
                  prev ? { ...prev, hueBase: value } : null,
                );
              }}
            />
          </div>

          {}
          {rawCurrentPattern === "fractal" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.fractal}
              </h4>

              {}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-[var(--color-subtext)]">
                    {t("labels.zoom")}
                  </label>
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {patternState.fractalZoom.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={patternState.fractalZoom}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    renderer.setFractalZoom(value);
                    setPatternState((prev) =>
                      prev ? { ...prev, fractalZoom: value } : null,
                    );
                  }}
                  className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
                />
              </div>

              {}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-[var(--color-subtext)]">
                    {t("labels.offsetX")}
                  </label>
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {patternState.fractalOffsetX.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={patternState.fractalOffsetX}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    renderer.setFractalOffsetX(value);
                    setPatternState((prev) =>
                      prev ? { ...prev, fractalOffsetX: value } : null,
                    );
                  }}
                  className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
                />
              </div>

              {}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-[var(--color-subtext)]">
                    {t("labels.offsetY")}
                  </label>
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {patternState.fractalOffsetY.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={patternState.fractalOffsetY}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    renderer.setFractalOffsetY(value);
                    setPatternState((prev) =>
                      prev ? { ...prev, fractalOffsetY: value } : null,
                    );
                  }}
                  className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
                />
              </div>

              {}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-[var(--color-subtext)]">
                    {t("labels.juliaCReal")}
                  </label>
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {patternState.juliaC.re.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={patternState.juliaC.re}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    renderer.setJuliaC(value, patternState.juliaC.im);
                    setPatternState((prev) =>
                      prev
                        ? {
                            ...prev,
                            juliaC: { ...prev.juliaC, re: value },
                          }
                        : null,
                    );
                  }}
                  className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
                />
              </div>

              {}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-[var(--color-subtext)]">
                    {t("labels.juliaCImaginary")}
                  </label>
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {patternState.juliaC.im.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={patternState.juliaC.im}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    renderer.setJuliaC(patternState.juliaC.re, value);
                    setPatternState((prev) =>
                      prev
                        ? {
                            ...prev,
                            juliaC: { ...prev.juliaC, im: value },
                          }
                        : null,
                    );
                  }}
                  className="slider-track accent-accent h-2 w-full cursor-pointer appearance-none rounded-full"
                />
              </div>
            </div>
          )}

          {}
          {rawCurrentPattern === "rays" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.rays}
              </h4>
              <SliderControl
                label={t("labels.rayCount")}
                value={patternParams.rayCount}
                min={6}
                max={72}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setRayCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "waves" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.waves}
              </h4>
              <SliderControl
                label={t("labels.waveCount")}
                value={patternParams.waveCount}
                min={1}
                max={15}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setWaveCount(value)}
              />
              <SliderControl
                label={t("labels.waveAmplitude")}
                value={patternParams.waveAmplitude}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setWaveAmplitude(value)}
              />
            </div>
          )}

          {}
          {(rawCurrentPattern === "swarm" || rawCurrentPattern === "fluid") && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.swarm}
              </h4>
              <SliderControl
                label={t("labels.particleCount")}
                value={patternParams.particleCount}
                min={50}
                max={2000}
                step={50}
                decimals={0}
                onChange={(value) => renderer.setParticleCount(value)}
              />
              <SliderControl
                label={t("labels.particleSize")}
                value={patternParams.particleSize}
                min={0.5}
                max={5.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setParticleSize(value)}
              />
              <SliderControl
                label={t("labels.particleSpeed")}
                value={patternParams.particleSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setParticleSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "bubbles" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.bubbles}
              </h4>
              <SliderControl
                label={t("labels.bubbleCount")}
                value={patternParams.bubbleCount}
                min={10}
                max={100}
                step={5}
                decimals={0}
                onChange={(value) => renderer.setBubbleCount(value)}
              />
              <SliderControl
                label={t("labels.bubbleSize")}
                value={patternParams.bubbleSize}
                min={0.5}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setBubbleSize(value)}
              />
              <SliderControl
                label={t("labels.bubbleSpeed")}
                value={patternParams.bubbleSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setBubbleSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "starfield" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.starfield}
              </h4>
              <SliderControl
                label={t("labels.starCount")}
                value={patternParams.starCount}
                min={50}
                max={500}
                step={10}
                decimals={0}
                onChange={(value) => renderer.setStarCount(value)}
              />
              <SliderControl
                label={t("labels.starSpeed")}
                value={patternParams.starSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setStarSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "rings" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.rings}
              </h4>
              <SliderControl
                label={t("labels.ringCount")}
                value={patternParams.ringCount}
                min={3}
                max={30}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setRingCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "tunnel" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.tunnel}
              </h4>
              <SliderControl
                label={t("labels.tunnelSpeed")}
                value={patternParams.tunnelSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setTunnelSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "matrix" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.matrix}
              </h4>
              <SliderControl
                label={t("labels.fallSpeed")}
                value={patternParams.matrixSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setMatrixSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "lightning" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.lightning}
              </h4>
              <SliderControl
                label={t("labels.lightningCount")}
                value={patternParams.lightningCount}
                min={1}
                max={10}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setLightningCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "galaxy" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.galaxy}
              </h4>
              <SliderControl
                label={t("labels.armCount")}
                value={patternParams.galaxyArmCount}
                min={2}
                max={8}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setGalaxyArmCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "mandala" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.mandala}
              </h4>
              <SliderControl
                label={t("labels.layerCount")}
                value={patternParams.mandalaLayers}
                min={1}
                max={12}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setMandalaLayers(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "tarot" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.tarot}
              </h4>
              <SliderControl
                label={t("labels.cardSize")}
                value={patternParams.tarotCardSize}
                min={0.5}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setTarotCardSize(value)}
              />
              <SliderControl
                label={t("labels.cardCount")}
                value={patternParams.tarotCardCount}
                min={3}
                max={22}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setTarotCardCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "sacredSpiral" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.sacredSpiral}
              </h4>
              <SliderControl
                label={t("labels.spiralCount")}
                value={patternParams.sacredSpiralCount}
                min={1}
                max={8}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setSacredSpiralCount(value)}
              />
              <SliderControl
                label={t("labels.spiralTightness")}
                value={patternParams.sacredSpiralTightness}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setSacredSpiralTightness(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "pentagram" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.pentagram}
              </h4>
              <SliderControl
                label={t("labels.size")}
                value={patternParams.pentagramSize}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPentagramSize(value)}
              />
              <SliderControl
                label={t("labels.rotationSpeed")}
                value={patternParams.pentagramRotationSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPentagramRotationSpeed(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "runes" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.runes}
              </h4>
              <SliderControl
                label={t("labels.runeSize")}
                value={patternParams.runeSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setRuneSize(value)}
              />
              <SliderControl
                label={t("labels.runeCount")}
                value={patternParams.runeCount}
                min={4}
                max={16}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setRuneCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "sigils" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.sigils}
              </h4>
              <SliderControl
                label={t("labels.sigilCount")}
                value={patternParams.sigilCount}
                min={3}
                max={12}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setSigilCount(value)}
              />
              <SliderControl
                label={t("labels.sigilSize")}
                value={patternParams.sigilSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setSigilSize(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "chakras" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.chakras}
              </h4>
              <SliderControl
                label={t("labels.chakraSize")}
                value={patternParams.chakraSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setChakraSize(value)}
              />
              <SliderControl
                label={t("labels.chakraSpacing")}
                value={patternParams.chakraSpacing}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setChakraSpacing(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "portal" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.portal}
              </h4>
              <SliderControl
                label={t("labels.portalSize")}
                value={patternParams.portalSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPortalSize(value)}
              />
              <SliderControl
                label={t("labels.ringCount")}
                value={patternParams.portalRingCount}
                min={3}
                max={12}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setPortalRingCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "phoenix" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.phoenix}
              </h4>
              <SliderControl
                label={t("labels.wingSpan")}
                value={patternParams.phoenixWingSpan}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPhoenixWingSpan(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "crystalGrid" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.crystalGrid}
              </h4>
              <SliderControl
                label={t("labels.crystalSize")}
                value={patternParams.crystalGridSize}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setCrystalGridSize(value)}
              />
              <SliderControl
                label={t("labels.crystalCount")}
                value={patternParams.crystalCount}
                min={6}
                max={24}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setCrystalCount(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "moonPhases" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.moonPhases}
              </h4>
              <SliderControl
                label={t("labels.phaseCount")}
                value={patternParams.moonPhaseCount}
                min={4}
                max={13}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setMoonPhaseCount(value)}
              />
              <SliderControl
                label={t("labels.moonSize")}
                value={patternParams.moonPhaseSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setMoonPhaseSize(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "flowerOfLife" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.flowerOfLife}
              </h4>
              <SliderControl
                label={t("labels.circleCount")}
                value={patternParams.flowerOfLifeCircleCount}
                min={1}
                max={19}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setFlowerOfLifeCircleCount(value)}
              />
              <SliderControl
                label={t("labels.patternSize")}
                value={patternParams.flowerOfLifeSize}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setFlowerOfLifeSize(value)}
              />
            </div>
          )}

          {}
          {rawCurrentPattern === "metatron" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.metatron}
              </h4>
              <SliderControl
                label={t("labels.nodeCount")}
                value={patternParams.metatronNodeCount}
                min={7}
                max={19}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setMetatronNodeCount(value)}
              />
              <SliderControl
                label={t("labels.cubeSize")}
                value={patternParams.metatronSize}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setMetatronSize(value)}
              />
            </div>
          )}

          {/* Torus Field Controls */}
          {rawCurrentPattern === "torusField" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.torusField}
              </h4>
              <SliderControl
                label={t("labels.ringCount")}
                value={patternParams.torusRingCount}
                min={6}
                max={24}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setTorusRingCount(value)}
              />
              <SliderControl
                label={t("labels.torusThickness")}
                value={patternParams.torusThickness}
                min={0.3}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setTorusThickness(value)}
              />
            </div>
          )}

          {/* Labyrinth Controls */}
          {rawCurrentPattern === "labyrinth" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.labyrinth}
              </h4>
              <SliderControl
                label={t("labels.complexity")}
                value={patternParams.labyrinthComplexity}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setLabyrinthComplexity(value)}
              />
              <SliderControl
                label={t("labels.pathWidth")}
                value={patternParams.labyrinthPathWidth}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setLabyrinthPathWidth(value)}
              />
            </div>
          )}

          {/* Vortex Spiral Controls */}
          {rawCurrentPattern === "vortexSpiral" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.vortexSpiral}
              </h4>
              <SliderControl
                label={t("labels.spiralCount")}
                value={patternParams.vortexSpiralCount}
                min={2}
                max={12}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setVortexSpiralCount(value)}
              />
              <SliderControl
                label={t("labels.rotationSpeed")}
                value={patternParams.vortexRotationSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setVortexRotationSpeed(value)}
              />
            </div>
          )}

          {/* Dragon Eye Controls */}
          {rawCurrentPattern === "dragonEye" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.dragonEye}
              </h4>
              <SliderControl
                label={t("labels.eyeSize")}
                value={patternParams.dragonEyeSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setDragonEyeSize(value)}
              />
              <SliderControl
                label={t("labels.pupilSize")}
                value={patternParams.dragonPupilSize}
                min={0.3}
                max={1.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setDragonPupilSize(value)}
              />
            </div>
          )}

          {/* Ancient Glyphs Controls */}
          {rawCurrentPattern === "ancientGlyphs" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.ancientGlyphs}
              </h4>
              <SliderControl
                label={t("labels.glyphCount")}
                value={patternParams.ancientGlyphCount}
                min={8}
                max={32}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setAncientGlyphCount(value)}
              />
              <SliderControl
                label={t("labels.glyphSize")}
                value={patternParams.ancientGlyphSize}
                min={0.5}
                max={2.5}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setAncientGlyphSize(value)}
              />
            </div>
          )}

          {/* Platonic Solids Controls */}
          {rawCurrentPattern === "platonic" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.platonic}
              </h4>
              <SliderControl
                label={t("labels.solidSize")}
                value={patternParams.platonicSize}
                min={0.5}
                max={2.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPlatonicSize(value)}
              />
              <SliderControl
                label={t("labels.rotationSpeed")}
                value={patternParams.platonicRotationSpeed}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setPlatonicRotationSpeed(value)}
              />
            </div>
          )}

          {/* Cosmic Lotus Controls */}
          {rawCurrentPattern === "cosmicLotus" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.cosmicLotus}
              </h4>
              <SliderControl
                label={t("labels.layerCount")}
                value={patternParams.cosmicLotusLayerCount}
                min={2}
                max={12}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setCosmicLotusLayerCount(value)}
              />
              <SliderControl
                label={t("labels.petalCount")}
                value={patternParams.cosmicLotusPetalCount}
                min={4}
                max={16}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setCosmicLotusPetalCount(value)}
              />
            </div>
          )}

          {/* Kaleidoscope Controls */}
          {rawCurrentPattern === "kaleidoscope" && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">
                {sectionTitleMap.kaleidoscope}
              </h4>
              <SliderControl
                label={t("labels.segments")}
                value={patternParams.kaleidoscopeSegments}
                min={3}
                max={48}
                step={1}
                decimals={0}
                onChange={(value) => renderer.setKaleidoscopeSegments(value)}
              />
              <SliderControl
                label={t("labels.rotationSpeed")}
                value={patternParams.kaleidoscopeRotationSpeed}
                min={0.1}
                max={5.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) =>
                  renderer.setKaleidoscopeRotationSpeed(value)
                }
              />
              <SliderControl
                label={t("labels.particleDensity")}
                value={patternParams.kaleidoscopeParticleDensity}
                min={0.1}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) =>
                  renderer.setKaleidoscopeParticleDensity(value)
                }
              />
              <SliderControl
                label={t("labels.colorShift")}
                value={patternParams.kaleidoscopeColorShift}
                min={0.0}
                max={3.0}
                step={0.1}
                decimals={1}
                unit="x"
                onChange={(value) => renderer.setKaleidoscopeColorShift(value)}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
