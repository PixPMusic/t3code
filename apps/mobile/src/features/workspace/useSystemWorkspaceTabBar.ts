import { isDuoDevice } from "../../lib/device-type";
import { Platform } from "react-native";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { useDeviceType, useNativeLayoutMetrics } from "../../native/native-layout-metrics";

/** Where an iOS split window shows the workspace tabs instead of UIKit's tab bar. */
export function useSidebarWorkspaceTabs(): "picker" | "toolbar" | null {
  const { layout } = useAdaptiveWorkspaceLayout();
  const deviceType = useDeviceType();
  const metrics = useNativeLayoutMetrics();
  if (Platform.OS !== "ios" || !layout.usesSplitView) return null;
  if (deviceType === "pad") return "picker";
  // Portrait Duo has no system rail; keep its tabs in the sidebar like iPad.
  if (deviceType === "duo-unfolded" && (metrics?.verticalBarEdge ?? "none") === "none")
    return "picker";
  return (metrics?.verticalBarEdge ?? "none") === "none" ? "toolbar" : null;
}

export function useCompactWorkspaceTabs() {
  const { layout } = useAdaptiveWorkspaceLayout();
  const deviceType = useDeviceType();
  // The compact glass picker reserves the trailing edge for a separate compose button.
  return Platform.OS === "ios" && !layout.usesSplitView && !isDuoDevice(deviceType);
}

export function useSystemWorkspaceTabBar() {
  const sidebarTabs = useSidebarWorkspaceTabs();
  const compactTabs = useCompactWorkspaceTabs();
  return Platform.OS === "ios" && sidebarTabs === null && !compactTabs;
}
