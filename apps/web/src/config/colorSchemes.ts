import {
  DEFAULT_COLOR_SCHEME,
  normalizeColorSchemeId,
  type ColorSchemeId,
} from "@starchild/types/settings";

export const COLOR_SCHEME_TRANSLATION_KEYS: Record<ColorSchemeId, string> = {
  starchild: "colorSchemeStarchild",
  "tokyo-night": "colorSchemeTokyoNight",
  dracula: "colorSchemeDracula",
  nord: "colorSchemeNord",
  gruvbox: "colorSchemeGruvbox",
  catppuccin: "colorSchemeCatppuccin",
  monokai: "colorSchemeMonokai",
  "solarized-dark": "colorSchemeSolarizedDark",
  "one-dark": "colorSchemeOneDark",
  "rose-pine": "colorSchemeRosePine",
};

export function applyColorSchemeToDocument(
  colorScheme: ColorSchemeId = DEFAULT_COLOR_SCHEME,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const htmlElement = document.documentElement;
  htmlElement.dataset.colorScheme = normalizeColorSchemeId(colorScheme);
  htmlElement.classList.add("theme-dark");
  htmlElement.classList.remove("theme-light");
}
