import { Platform } from "react-native";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";

export function useAndroidFloatingTabs() {
  const { androidNavigationStyle } = useAppearancePreferences();
  return Platform.OS === "android" && androidNavigationStyle === "one-ui";
}

// Native shadows need room inside the Expo view, which clips its children.
export const FLOATING_TABS = { edge: 16, gap: 12, shadow: 8 };

export function floatingTabsMetrics(
  count: number,
  scale: number,
  fabSize: number,
  paneWidth?: number,
) {
  const unit = Math.max(1, scale);
  const height = fabSize;
  const beside = 2 * FLOATING_TABS.edge + FLOATING_TABS.gap + fabSize;
  const row = beside + count * 60 * unit;
  const sharesRow = paneWidth === undefined || paneWidth >= row;
  const room =
    paneWidth === undefined
      ? count * 60 * unit
      : sharesRow
        ? paneWidth - beside
        : paneWidth - 2 * FLOATING_TABS.edge;
  return {
    pill: Math.min(count * 72 * unit, Math.max(0, room)),
    height,
    row,
    sharesRow,
    fabOffset: sharesRow ? (height - fabSize) / 2 : height + FLOATING_TABS.gap,
  };
}
