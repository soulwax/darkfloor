// File: apps/web/src/__tests__/mobilePlayerDrag.test.ts

import {
  clampDownwardDragOffset,
  getMobilePlayerDragDecision,
  getMobilePlayerDismissThreshold,
  MOBILE_PLAYER_DISMISS_THRESHOLD_RATIO,
} from "@/components/mobilePlayerDrag";
import { describe, expect, it } from "vitest";

describe("mobilePlayerDrag", () => {
  it("uses a 50% dismiss threshold", () => {
    expect(MOBILE_PLAYER_DISMISS_THRESHOLD_RATIO).toBe(0.5);
    expect(getMobilePlayerDismissThreshold(600)).toBe(300);
  });

  it("snaps back when drag offset is below 50%", () => {
    expect(getMobilePlayerDragDecision(299, 600)).toBe("snap_back");
  });

  it("dismisses when drag offset is exactly 50%", () => {
    expect(getMobilePlayerDragDecision(300, 600)).toBe("dismiss");
  });

  it("dismisses when drag offset exceeds 50%", () => {
    expect(getMobilePlayerDragDecision(320, 600)).toBe("dismiss");
  });

  it("clamps upward offsets and keeps panel open", () => {
    expect(clampDownwardDragOffset(-40)).toBe(0);
    expect(getMobilePlayerDragDecision(-40, 600)).toBe("snap_back");
  });
});
