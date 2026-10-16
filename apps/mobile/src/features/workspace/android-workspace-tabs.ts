import type { NavigationState } from "@react-navigation/native";
import type { WorkspaceTab } from "./workspace-tabs-state";

/** The Settings tab reuses the settings navigator, with its own root and ordinary nested Back. */
export function androidWorkspaceTabNavigationState(state: NavigationState, tab: WorkspaceTab) {
  const home = state.routes.find((route) => route.name === "Home") ?? { name: "Home" };
  if (tab === "threads" || tab === "pullRequests") return { ...state, index: 0, routes: [home] };
  return {
    ...state,
    index: 1,
    routes: [
      home,
      {
        name: "SettingsSheet",
        params: {
          screen: "SettingsContent",
          params: { screen: "Settings" },
        },
      },
    ],
  };
}

/** Settings stays selected while any of its nested pages is on top. */
export function androidWorkspaceTabFromNavigationState(
  state: NavigationState,
  selected: WorkspaceTab,
): WorkspaceTab {
  const top = state.routes
    .slice(0, state.index + 1)
    .findLast((route) => ["Home", "Thread", "PullRequest", "SettingsSheet"].includes(route.name));
  if (top?.name === "SettingsSheet") return "settings";
  return selected === "settings" ? "threads" : selected;
}
