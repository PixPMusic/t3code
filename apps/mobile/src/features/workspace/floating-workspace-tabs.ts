import { Platform } from "react-native";
import { manufacturer } from "expo-device";

// EXPO_PUBLIC_T3_FLOATING_TABS=1 also enables the Samsung layout on other Android devices.
export const ANDROID_FLOATING_TABS =
  Platform.OS === "android" &&
  (manufacturer?.toLowerCase() === "samsung" || process.env.EXPO_PUBLIC_T3_FLOATING_TABS === "1");

// Native shadows need room inside the Expo view, which clips its children.
export const FLOATING_TABS = { edge: 16, gap: 12, shadow: 8 };

export function floatingTabsMetrics(
  count: number,
  scale: number,
  fabSize: number,
  paneWidth?: number,
) {
  const unit = Math.max(1, scale);
  const height = Math.round(64 * unit);
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
