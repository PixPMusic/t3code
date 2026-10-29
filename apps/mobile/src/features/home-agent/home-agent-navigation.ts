import { createContext, use } from "react";
import { Platform } from "react-native";
import { useNativeLayoutMetrics } from "../../native/native-layout-metrics";
import { useAndroidFloatingTabs } from "../settings/appearance/AppearancePreferencesProvider";
import { useAdaptiveWorkspaceLayout } from "../layout/adaptive-workspace-context";

export const HomeAgentRailContext = createContext(false);
export const useHomeAgentRail = () => use(HomeAgentRailContext);

export function useHomeAgentNavigationRail() {
  const metrics = useNativeLayoutMetrics();
  const { layout } = useAdaptiveWorkspaceLayout();
  const floatingTabs = useAndroidFloatingTabs();
  return Platform.OS === "android"
    ? layout.usesSplitView && !floatingTabs
    : (metrics?.verticalBarEdge ?? "none") !== "none";
}
