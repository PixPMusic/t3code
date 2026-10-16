import { Platform } from "react-native";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { useNativeLayoutMetrics } from "../../native/native-layout-metrics";

export function useSidebarWorkspaceTabs() {
  const { layout } = useAdaptiveWorkspaceLayout();
  const metrics = useNativeLayoutMetrics();
  // The Duo's side rail carries the tabs; without it (unfolded in portrait),
  // the split follows iPad.
  return (
    Platform.OS === "ios" &&
    layout.usesSplitView &&
    (Platform.isPad || (metrics?.verticalBarEdge ?? "none") === "none")
  );
}

/** Compact iOS windows use UIKit tabs; wide iPad windows use the sidebar picker. */
export function useSystemWorkspaceTabBar() {
  const sidebarTabs = useSidebarWorkspaceTabs();
  return Platform.OS === "ios" && !sidebarTabs;
}
