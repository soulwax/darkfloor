// File: packages/ui/src/utils/haptics.ts

export type HapticPattern =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "error"
  | "warning"
  | "selection"
  | "impact"
  | "notification"
  | "swipe"
  | "toggle"
  | "slider"
  | "sliderTick"
  | "sliderEnd"
  | "scrub"
  | "boundary";

const patterns: Record<HapticPattern, number | number[]> = {
  light: 6,
  medium: 10,
  heavy: 16,

  success: [8, 45, 10],
  error: [10, 35, 10, 35, 14],
  warning: [8, 30, 8],

  selection: 4,
  impact: 12,
  notification: [6, 60, 6, 60, 12],

  swipe: [5, 20, 5],
  toggle: 7,
  slider: 3,
  sliderTick: 4,
  sliderEnd: 8,
  scrub: 3,
  boundary: [6, 24, 6],
};

const HAPTIC_GLOBAL_MIN_INTERVAL_MS = 16;
const HAPTIC_DEFAULT_MIN_INTERVAL_MS = 50;
const HAPTIC_PRIORITY_PATTERNS = new Set<HapticPattern>([
  "success",
  "error",
  "warning",
  "notification",
]);
const HAPTIC_MIN_INTERVAL_MS: Partial<Record<HapticPattern, number>> = {
  light: 45,
  selection: 45,
  slider: 35,
  sliderTick: 40,
  scrub: 35,
  toggle: 60,
  swipe: 55,
  boundary: 90,
  sliderEnd: 90,
  medium: 70,
  impact: 70,
  heavy: 90,
  success: 120,
  warning: 120,
  error: 160,
  notification: 180,
};

let lastHapticAt = 0;
const lastPatternAt = new Map<HapticPattern, number>();

const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function haptic(pattern: HapticPattern = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  try {
    const now = nowMs();
    const minInterval =
      HAPTIC_MIN_INTERVAL_MS[pattern] ?? HAPTIC_DEFAULT_MIN_INTERVAL_MS;
    const lastPatternTime = lastPatternAt.get(pattern) ?? 0;
    const isPriority = HAPTIC_PRIORITY_PATTERNS.has(pattern);

    if (!isPriority && now - lastHapticAt < HAPTIC_GLOBAL_MIN_INTERVAL_MS) {
      return;
    }

    if (now - lastPatternTime < minInterval) {
      return;
    }

    const vibrationPattern = patterns[pattern];
    navigator.vibrate(vibrationPattern);
    lastHapticAt = now;
    lastPatternAt.set(pattern, now);
  } catch {
  }
}

const throttleTimers = new Map<string, number>();

export function hapticThrottled(
  pattern: HapticPattern,
  key: string,
  intervalMs = 50,
): void {
  const now = nowMs();
  const lastTime = throttleTimers.get(key) ?? 0;

  if (now - lastTime >= intervalMs) {
    haptic(pattern);
    throttleTimers.set(key, now);
  }
}

let lastSliderValue = 0;
let lastSliderTime = 0;

export function hapticSliderContinuous(
  value: number,
  min = 0,
  max = 100,
  options: {
    intervalMs?: number;
    tickThreshold?: number;
    boundaryFeedback?: boolean;
  } = {},
): void {
  const {
    intervalMs = 40,
    tickThreshold = 2,
    boundaryFeedback = true,
  } = options;

  const now = nowMs();
  if (now - lastSliderTime < intervalMs) {
    return;
  }

  const normalizedValue = ((value - min) / (max - min)) * 100;
  const lastNormalized = ((lastSliderValue - min) / (max - min)) * 100;
  const delta = Math.abs(normalizedValue - lastNormalized);

  if (boundaryFeedback) {
    const atBoundary =
      (value <= min && lastSliderValue > min) ||
      (value >= max && lastSliderValue < max);
    if (atBoundary) {
      haptic("boundary");
      lastSliderTime = now;
      lastSliderValue = value;
      return;
    }
  }

  if (delta >= tickThreshold) {
    haptic("sliderTick");
    lastSliderTime = now;
    lastSliderValue = value;
  }
}

export function hapticSliderEnd(): void {
  haptic("sliderEnd");
  lastSliderValue = 0;
  lastSliderTime = 0;
}

let lastScrubTime = 0;
const SCRUB_INTERVAL = 30;

export function hapticScrub(): void {
  const now = nowMs();
  if (now - lastScrubTime >= SCRUB_INTERVAL) {
    haptic("scrub");
    lastScrubTime = now;
  }
}

export function hapticLight(): void {
  haptic("light");
}

export function hapticMedium(): void {
  haptic("medium");
}

export function hapticHeavy(): void {
  haptic("heavy");
}

export function hapticSuccess(): void {
  haptic("success");
}

export function hapticError(): void {
  haptic("error");
}

export function hapticWarning(): void {
  haptic("warning");
}

export function hapticSelection(): void {
  haptic("selection");
}

export function hapticImpact(): void {
  haptic("impact");
}

export function hapticNotification(): void {
  haptic("notification");
}

export function hapticSwipe(): void {
  haptic("swipe");
}

export function hapticToggle(): void {
  haptic("toggle");
}

export function hapticSlider(): void {
  haptic("slider");
}

export function isHapticSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticCustom(pattern: number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {

  }
}

export function hapticStop(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(0);
  } catch {

  }
}
