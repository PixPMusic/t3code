import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DesktopWallpaperThemeSource } from "@t3tools/contracts";

import { useTheme } from "../../hooks/useTheme";
import { cn, randomUUID } from "../../lib/utils";
import type { MaterialYouStyle } from "../../materialYouTheme";
import {
  applyThemeColorPreview,
  getThemeColorsForMode,
  installCustomTheme,
  removeCustomTheme,
  type ThemeAppearance,
  type ThemeDefinition,
} from "../../themePalette";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { getThemeCardDefinition, ThemePreviewCircle } from "./ThemePreviewCircles";

const STYLES = [
  { id: "vibrant", label: "Vibrant" },
  { id: "expressive", label: "Expressive" },
  { id: "tonalSpot", label: "Tonal Spot" },
] as const;

type WallpaperChoice = {
  seed: string;
  themes: Record<MaterialYouStyle, ThemeDefinition>;
};

function reportError(error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title: "Couldn’t create a Material You theme",
      description: error instanceof Error ? error.message : "Try choosing an image instead.",
    }),
  );
}

export function WallpaperThemeSettings({
  onSaved,
}: {
  onSaved: (theme: ThemeDefinition) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  if (!bridge?.getWallpaperThemeColors) return null;

  return (
    <div className="rounded-xl border border-border/70">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-xl">
          <ChevronRightIcon
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground", expanded && "rotate-90")}
          />
          <span className="flex-1 text-sm font-medium">Material You</span>
          <span className="text-xs text-muted-foreground">Experimental</span>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          {expanded ? <WallpaperThemePicker onSaved={onSaved} /> : null}
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}

function WallpaperThemePicker({ onSaved }: { onSaved: (theme: ThemeDefinition) => boolean }) {
  const { resolvedTheme, refreshTheme } = useTheme();
  const [previewAppearance, setPreviewAppearance] = useState<ThemeAppearance>(resolvedTheme);
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<DesktopWallpaperThemeSource | null>(null);
  const [choices, setChoices] = useState<ReadonlyArray<WallpaperChoice>>([]);
  const [style, setStyle] = useState<MaterialYouStyle>("vibrant");
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  const platform = bridge?.getClientPlatform?.();
  const canReadNativeColors = platform === "darwin" || platform === "win32";
  const selectedTheme = choices.find((choice) => choice.seed === selectedSeed)?.themes[style];

  useEffect(() => {
    if (!selectedTheme) return;
    const colors = getThemeColorsForMode(selectedTheme, previewAppearance);
    if (!colors) return;
    applyThemeColorPreview(colors, previewAppearance);
    // Restores the saved selection on cancel, collapse, close, or navigation.
    return refreshTheme;
  }, [previewAppearance, refreshTheme, selectedTheme]);

  const readColors = async (source: DesktopWallpaperThemeSource) => {
    if (pendingSource !== null || !bridge?.getWallpaperThemeColors) return;
    setPendingSource(source);
    try {
      const seeds = await bridge.getWallpaperThemeColors(source);
      if (seeds === null) return;
      // Keep the color engine out of startup and ordinary theme selection.
      const { createMaterialYouTheme } = await import("../../materialYouTheme");
      setSelectedSeed(null);
      setChoices(
        seeds.map((seed) => {
          const makeTheme = (variant: MaterialYouStyle) => createMaterialYouTheme(seed, variant);
          return {
            seed,
            themes: {
              vibrant: makeTheme("vibrant"),
              expressive: makeTheme("expressive"),
              tonalSpot: makeTheme("tonalSpot"),
            },
          };
        }),
      );
    } catch (error) {
      reportError(error);
    } finally {
      setPendingSource(null);
    }
  };

  const savePalette = () => {
    if (!selectedTheme || pendingSource !== null) return;
    try {
      const installed = installCustomTheme({ ...selectedTheme, id: `material-${randomUUID()}` });
      if (!onSaved(installed)) {
        removeCustomTheme(installed.id);
        reportError(new Error("Couldn’t save your theme selection. Try again."));
      }
    } catch (error) {
      reportError(error);
    }
  };

  return (
    <div className="space-y-3 border-t border-border/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {canReadNativeColors
            ? "Start with your wallpaper, system accent, or an image."
            : "Start with an image."}
        </p>
        <div className="flex flex-wrap gap-2">
          {canReadNativeColors ? (
            <>
              <Button
                size="xs"
                variant="outline"
                disabled={pendingSource !== null}
                onClick={() => void readColors("wallpaper")}
              >
                {pendingSource === "wallpaper" ? "Reading colors…" : "Create from wallpaper"}
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={pendingSource !== null}
                onClick={() => void readColors("accent")}
              >
                {pendingSource === "accent" ? "Reading color…" : "Use system accent"}
              </Button>
            </>
          ) : null}
          <Button
            size="xs"
            variant="outline"
            disabled={pendingSource !== null}
            onClick={() => void readColors("image")}
          >
            {pendingSource === "image" ? "Reading colors…" : "Choose image"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Preview palettes, then save one theme with light and dark modes. Saved themes are snapshots.
        Images stay on this device.
      </p>
      {choices.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Material color style">
            {STYLES.map((variant) => (
              <Button
                key={variant.id}
                size="xs"
                variant={style === variant.id ? "secondary" : "ghost"}
                aria-pressed={style === variant.id}
                onClick={() => setStyle(variant.id)}
              >
                {variant.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {style === "expressive"
              ? "Contrasting hues inspired by your source color. Select a palette to preview it."
              : style === "tonalSpot"
                ? "Softer, muted accents. Select a palette to preview it."
                : "Rich accents that keep the source hue. Select a palette to preview it."}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {choices.map(({ seed, themes }) => {
              const theme = themes[style];
              return (
                <button
                  key={seed}
                  type="button"
                  aria-label={`Preview ${theme.label}`}
                  aria-pressed={selectedSeed === seed}
                  disabled={pendingSource !== null}
                  className="space-y-2 rounded-lg border border-border/70 p-2 transition-colors hover:bg-accent/10 aria-pressed:border-ring aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                  onClick={() => setSelectedSeed(seed)}
                >
                  <div className="flex justify-center gap-1">
                    {getThemeCardDefinition(theme).previews.map((preview) => (
                      <ThemePreviewCircle
                        key={preview.mode}
                        colors={preview.colors}
                        mode={preview.mode}
                        className="size-10"
                      />
                    ))}
                  </div>
                  <div aria-hidden className="flex h-5 overflow-hidden rounded-full">
                    {(["accent", "secondary", "update"] as const).map((role) => (
                      <span
                        key={role}
                        className="flex-1"
                        style={{ backgroundColor: theme.colors[role] }}
                      />
                    ))}
                  </div>
                  <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: seed }}
                    />
                    {seed}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Preview appearance">
              {(["light", "dark"] as const).map((appearance) => (
                <Button
                  key={appearance}
                  size="xs"
                  variant={previewAppearance === appearance ? "secondary" : "ghost"}
                  aria-pressed={previewAppearance === appearance}
                  onClick={() => setPreviewAppearance(appearance)}
                >
                  {appearance === "light" ? "Light" : "Dark"}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!selectedTheme}
                onClick={() => setSelectedSeed(null)}
              >
                Cancel preview
              </Button>
              <Button
                size="sm"
                disabled={!selectedTheme || pendingSource !== null}
                onClick={savePalette}
              >
                Save theme
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
