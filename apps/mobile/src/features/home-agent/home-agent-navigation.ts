import { createContext, use } from "react";
import { Platform } from "react-native";
import { useNativeLayoutMetrics } from "../../native/native-layout-metrics";
import { useAdaptiveWorkspaceLayout } from "../layout/adaptive-workspace-context";

export const HomeAgentRailContext = createContext(false);
export const useHomeAgentRail = () => use(HomeAgentRailContext);

export function useHomeAgentNavigationRail() {
  const metrics = useNativeLayoutMetrics();
  const { navigationRailVisible } = useAdaptiveWorkspaceLayout();
  return Platform.OS === "android"
    ? navigationRailVisible
    : (metrics?.verticalBarEdge ?? "none") !== "none";
}
