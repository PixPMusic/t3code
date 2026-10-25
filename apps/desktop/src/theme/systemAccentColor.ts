import { systemPreferences } from "electron";

/** Electron returns RRGGBBAA; Material needs an opaque RGB seed. */
export function readSystemAccentColor(): string {
  const rgba = systemPreferences.getAccentColor();
  if (typeof rgba !== "string" || !/^[0-9a-f]{8}$/i.test(rgba)) {
    throw new Error("The system accent color is unavailable. Try choosing an image.");
  }
  return `#${rgba.slice(0, 6).toLowerCase()}`;
}
