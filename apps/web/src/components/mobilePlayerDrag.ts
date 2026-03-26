// File: apps/web/src/components/mobilePlayerDrag.ts

export const MOBILE_PLAYER_DISMISS_THRESHOLD_RATIO = 0.24;
export const MOBILE_PLAYER_DISMISS_MIN_VELOCITY = 650;
export const MOBILE_PLAYER_DISMISS_MIN_OFFSET = 32;

export type MobilePlayerDragDecision = "dismiss" | "snap_back";

export const clampDownwardDragOffset = (offsetY: number): number => {
  if (!Number.isFinite(offsetY)) {
    return 0;
  }

  return Math.max(offsetY, 0);
};

export const getMobilePlayerDismissThreshold = (
  panelHeight: number,
  thresholdRatio = MOBILE_PLAYER_DISMISS_THRESHOLD_RATIO,
): number => {
  if (!Number.isFinite(panelHeight) || panelHeight <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const ratio = Math.max(0, thresholdRatio);
  return panelHeight * ratio;
};

export const getMobilePlayerDragDecision = (
  offsetY: number,
  panelHeight: number,
  velocityY = 0,
  thresholdRatio = MOBILE_PLAYER_DISMISS_THRESHOLD_RATIO,
): MobilePlayerDragDecision => {
  const clampedOffset = clampDownwardDragOffset(offsetY);
  const dismissThreshold = getMobilePlayerDismissThreshold(
    panelHeight,
    thresholdRatio,
  );

  if (clampedOffset >= dismissThreshold) {
    return "dismiss";
  }

  return clampedOffset >= MOBILE_PLAYER_DISMISS_MIN_OFFSET &&
    velocityY >= MOBILE_PLAYER_DISMISS_MIN_VELOCITY
    ? "dismiss"
    : "snap_back";
};
