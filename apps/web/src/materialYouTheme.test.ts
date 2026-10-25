import { describe, expect, it } from "vite-plus/test";

import { Hct, argbFromHex } from "@material/material-color-utilities";

import { createMaterialYouTheme } from "./materialYouTheme";
import {
  getThemeColorsForMode,
  getThemeModes,
  isThemeColor,
  parseThemeFile,
  serializeThemeFile,
  THEME_COLOR_ROLES,
  themeColorToHex,
  type ThemeColorRole,
} from "./themePalette";

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const hex = themeColorToHex(value)!;
    return [0.2126, 0.7152, 0.0722].reduce((total, weight, index) => {
      const channel = Number.parseInt(hex.slice(index * 2 + 1, index * 2 + 3), 16) / 255;
      const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return total + linear * weight;
    }, 0);
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe.each(["vibrant", "expressive", "tonalSpot"] as const)(
  "Material You %s themes",
  (style) => {
    it.each([
      "#000000",
      "#ffffff",
      "#808080",
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#a68164",
      "#de2aca",
      "#268bce",
    ])("creates complete, readable light and dark palettes from %s", (seed) => {
      const theme = createMaterialYouTheme(seed, style);
      expect(getThemeModes(theme)).toEqual(["light", "dark"]);

      const textPairs: ReadonlyArray<readonly [ThemeColorRole, ThemeColorRole]> = [
        ["text", "canvas"],
        ["text", "surface"],
        ["text", "surfaceRaised"],
        ["text", "surfaceOverlay"],
        ["textMuted", "canvas"],
        ["mutedForeground", "muted"],
        ["toolbarForeground", "toolbar"],
        ["toolbarControlForeground", "toolbarControlHover"],
        ["secondaryForeground", "secondary"],
        ["accentForeground", "accent"],
        ["accentSurfaceForeground", "accentSurface"],
        ["messageForeground", "messageSurface"],
        ["messageActionForeground", "messageAction"],
        ["messageActionForeground", "messageActionHover"],
        ["codeForeground", "codeBackground"],
        ["sidebarForeground", "sidebar"],
        ["sidebarForeground", "sidebarRowSelected"],
        ["sidebarMutedForeground", "sidebarRowHover"],
        ["terminalForeground", "terminalBackground"],
        ["terminalForeground", "terminalSelection"],
        ["errorForeground", "errorSurface"],
        ["updateForeground", "updateSurface"],
      ];
      for (const mode of ["light", "dark"] as const) {
        const colors = getThemeColorsForMode(theme, mode)!;
        expect(colors.chrome).toBe(colors.canvas);
        expect(colors.toolbar).toBe(colors.canvas);
        expect(Object.keys(colors).sort()).toEqual([...THEME_COLOR_ROLES].sort());
        for (const color of Object.values(colors)) expect(isThemeColor(color)).toBe(true);
        for (const [foreground, background] of textPairs) {
          expect(
            contrastRatio(colors[foreground], colors[background]),
            `${mode} ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrastRatio(colors.focus, colors.canvas)).toBeGreaterThanOrEqual(3);
        // Destructive buttons and badges use white, not the alert foreground.
        expect(contrastRatio("#ffffff", colors.error)).toBeGreaterThanOrEqual(4.5);
        // The same token appears as inline error text on ordinary surfaces.
        expect(contrastRatio(colors.error, colors.canvas)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.error, colors.surface)).toBeGreaterThanOrEqual(3);
      }
      expect(getThemeColorsForMode(theme, "light")?.canvas).not.toBe(
        getThemeColorsForMode(theme, "dark")?.canvas,
      );
    });

    it("is deterministic and ignores hex letter case", () => {
      expect(createMaterialYouTheme("#6f8AbC", style)).toEqual(
        createMaterialYouTheme("#6f8abc", style),
      );
    });

    it("keeps different seed hues visible in the palette", () => {
      const red = createMaterialYouTheme("#ff0000", style);
      const blue = createMaterialYouTheme("#0000ff", style);
      for (const mode of ["light", "dark"] as const) {
        expect(getThemeColorsForMode(red, mode)?.accent).not.toBe(
          getThemeColorsForMode(blue, mode)?.accent,
        );
      }
    });

    it("round trips through normal theme export and import", () => {
      const theme = createMaterialYouTheme("#a68164", style);
      const imported = parseThemeFile(JSON.parse(serializeThemeFile(theme)));
      expect(imported.id).toBe(theme.id);
      expect(imported.label).toBe(theme.label);
      expect(imported.managed).not.toBe(true);
      for (const mode of ["light", "dark"] as const) {
        for (const role of THEME_COLOR_ROLES) {
          expect(themeColorToHex(getThemeColorsForMode(imported, mode)![role])).toBe(
            themeColorToHex(getThemeColorsForMode(theme, mode)![role]),
          );
        }
      }
    });

    it.each(["red", "#fff", "ffffff", "#ffffff00", "#gggggg", "", " #a68164"])(
      "rejects invalid seed %j",
      (seed) => expect(() => createMaterialYouTheme(seed, style)).toThrow("#rrggbb"),
    );
  },
);

it("preserves much more magenta chroma in Vibrant than Tonal Spot", () => {
  const vivid = createMaterialYouTheme("#de2aca", "vibrant");
  const muted = createMaterialYouTheme("#de2aca", "tonalSpot");
  const chroma = (hex: string) => Hct.fromInt(argbFromHex(hex)).chroma;
  expect(chroma(vivid.colors.accent)).toBeGreaterThan(chroma(muted.colors.accent) * 2);
  expect(vivid.id).not.toBe(muted.id);
});
