import type { MobileAccentTone } from "./types";

export const mobileTheme = {
  colors: {
    screen: "#07111c",
    screenAlt: "#0a1625",
    surface: "rgba(11, 21, 35, 0.94)",
    surfaceRaised: "rgba(14, 27, 45, 0.96)",
    surfaceMuted: "rgba(255, 255, 255, 0.04)",
    outline: "rgba(157, 197, 255, 0.18)",
    outlineStrong: "rgba(157, 197, 255, 0.28)",
    text: "#f4f8ff",
    textMuted: "#b8cae3",
    textSubtle: "#88a0be",
    mint: "#8ff8f1",
    mintDeep: "#5de2d8",
    coral: "#ffb38a",
    gold: "#f7d77d",
    blue: "#8bb9ff",
  },
  radius: {
    pill: 999,
    card: 26,
    section: 24,
    compact: 18,
  },
} as const;

interface AccentPalette {
  background: string;
  border: string;
  text: string;
  accent: string;
}

export function getAccentPalette(tone: MobileAccentTone): AccentPalette {
  switch (tone) {
    case "mint":
      return {
        background: "rgba(143, 248, 241, 0.10)",
        border: "rgba(143, 248, 241, 0.22)",
        text: "#dffefb",
        accent: mobileTheme.colors.mint,
      };
    case "coral":
      return {
        background: "rgba(255, 179, 138, 0.12)",
        border: "rgba(255, 179, 138, 0.22)",
        text: "#fff0e7",
        accent: mobileTheme.colors.coral,
      };
    case "gold":
      return {
        background: "rgba(247, 215, 125, 0.12)",
        border: "rgba(247, 215, 125, 0.24)",
        text: "#fff7db",
        accent: mobileTheme.colors.gold,
      };
    case "blue":
    default:
      return {
        background: "rgba(139, 185, 255, 0.12)",
        border: "rgba(139, 185, 255, 0.22)",
        text: "#eef5ff",
        accent: mobileTheme.colors.blue,
      };
  }
}

export function formatTrackDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function createMonogram(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "ST";
}
