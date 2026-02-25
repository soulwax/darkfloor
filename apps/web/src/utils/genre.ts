// File: apps/web/src/utils/genre.ts

export function parsePreferredGenreId(
  value: number | string | null,
): number | null {
  if (typeof value === "number") {
    const normalized = Math.trunc(value);
    return normalized > 0 ? normalized : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
