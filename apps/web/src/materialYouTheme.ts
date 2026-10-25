import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeExpressive,
  SchemeTonalSpot,
  SchemeVibrant,
} from "@material/material-color-utilities";

import {
  getStandardThemeColors,
  type ThemeAppearance,
  type ThemeColors,
  type ThemeDefinition,
} from "./themePalette";

const MATERIAL_STYLES = {
  vibrant: { scheme: SchemeVibrant, label: "Vibrant" },
  expressive: { scheme: SchemeExpressive, label: "Expressive" },
  tonalSpot: { scheme: SchemeTonalSpot, label: "Tonal Spot" },
};

export type MaterialYouStyle = keyof typeof MATERIAL_STYLES;

function materialColors(
  seed: number,
  appearance: ThemeAppearance,
  style: MaterialYouStyle,
): ThemeColors {
  const Scheme = MATERIAL_STYLES[style].scheme;
  const scheme = new Scheme(Hct.fromInt(seed), appearance === "dark", 0);
  const color = hexFromArgb;

  return {
    // Material has no warning role; keep T3's semantic amber colors.
    ...getStandardThemeColors(appearance),
    canvas: color(scheme.surface),
    chrome: color(scheme.surface),
    toolbar: color(scheme.surface),
    toolbarForeground: color(scheme.onSurface),
    toolbarBorder: color(scheme.outlineVariant),
    toolbarControl: color(scheme.surfaceContainer),
    toolbarControlForeground: color(scheme.onSurface),
    toolbarControlHover: color(scheme.surfaceContainerHigh),
    surface: color(scheme.surfaceContainerLow),
    surfaceRaised: color(scheme.surfaceContainer),
    surfaceOverlay: color(scheme.surfaceContainerHigh),
    text: color(scheme.onSurface),
    textMuted: color(scheme.onSurfaceVariant),
    border: color(scheme.outlineVariant),
    input: color(scheme.outline),
    focus: color(scheme.primary),
    accent: color(scheme.primary),
    accentForeground: color(scheme.onPrimary),
    secondary: color(scheme.secondaryContainer),
    secondaryForeground: color(scheme.onSecondaryContainer),
    muted: color(scheme.surfaceContainerHighest),
    mutedForeground: color(scheme.onSurfaceVariant),
    placeholder: color(scheme.onSurfaceVariant),
    secondaryLabel: color(scheme.onSurfaceVariant),
    iconMuted: color(scheme.onSurfaceVariant),
    // T3 also uses error for white-label destructive controls. Keep dark mode
    // below tone 50 for those labels, but bright enough for inline error text.
    error: color(scheme.errorPalette.tone(appearance === "dark" ? 49 : 40)),
    errorForeground: color(scheme.onErrorContainer),
    errorSurface: color(scheme.errorContainer),
    update: color(scheme.tertiary),
    updateForeground: color(scheme.onTertiaryContainer),
    updateSurface: color(scheme.tertiaryContainer),
    accentSurface: color(scheme.primaryContainer),
    accentSurfaceForeground: color(scheme.onPrimaryContainer),
    messageSurface: color(scheme.primaryContainer),
    messageForeground: color(scheme.onPrimaryContainer),
    messageAction: color(scheme.primary),
    messageActionForeground: color(scheme.onPrimary),
    messageActionHover: color(scheme.primaryPalette.tone(appearance === "dark" ? 85 : 35)),
    codeBackground: color(scheme.surfaceContainerLowest),
    codeForeground: color(scheme.onSurface),
    sidebar: color(scheme.surfaceContainerLow),
    sidebarForeground: color(scheme.onSurface),
    sidebarMutedForeground: color(scheme.onSurfaceVariant),
    sidebarControlSurface: color(scheme.surfaceContainer),
    sidebarRowHover: color(scheme.surfaceContainerHigh),
    sidebarRowActive: color(scheme.secondaryContainer),
    sidebarRowSelected: color(scheme.secondaryContainer),
    sidebarBorder: color(scheme.outlineVariant),
    terminalBackground: color(scheme.surface),
    terminalForeground: color(scheme.onSurface),
    terminalCursor: color(scheme.primary),
    terminalSelection: color(scheme.secondaryContainer),
    terminalScrollbar: color(scheme.outlineVariant),
    terminalScrollbarHover: color(scheme.outline),
  };
}

/** Generate a regular editable theme. Image data and paths never enter the palette. */
export function createMaterialYouTheme(
  seed: string,
  style: MaterialYouStyle = "vibrant",
): ThemeDefinition {
  if (!/^#[\da-f]{6}$/i.test(seed)) {
    throw new Error("Material You needs a color in #rrggbb format.");
  }
  const normalizedSeed = seed.toLowerCase();
  const argb = argbFromHex(normalizedSeed);
  const light = materialColors(argb, "light", style);
  const dark = materialColors(argb, "dark", style);
  return {
    id: `material-you-${style.toLowerCase()}-${normalizedSeed.slice(1)}`,
    label: `Material You ${MATERIAL_STYLES[style].label} ${normalizedSeed}`,
    appearance: "light",
    colors: light,
    variants: { dark },
  };
}
