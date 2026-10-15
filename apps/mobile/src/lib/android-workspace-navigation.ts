import type { WorkspaceTab } from "../features/workspace/workspace-tabs-state";
import type { NavigationState } from "@react-navigation/native";

export type AndroidWorkspaceDestination =
  | { readonly name: "Thread"; readonly params: ReactNavigation.RootParamList["Thread"] }
  | { readonly name: "PullRequest"; readonly params: ReactNavigation.RootParamList["PullRequest"] };

export function androidWorkspaceNavigationState(
  state: NavigationState,
  destination?: AndroidWorkspaceDestination,
  reviewers?: ReactNavigation.RootParamList["PullRequestReviewers"],
) {
  const home = state.routes.find((route) => route.name === "Home") ?? { name: "Home" };
  if (!destination) return { ...state, index: 0, routes: [home] };
  const identity =
    destination.name === "Thread"
      ? ["environmentId", "threadId"]
      : ["environmentId", "projectId", "repository", "number", "host"];
  const params = destination.params as Readonly<Record<string, unknown>>;
  const existing = state.routes.findLast((route) => {
    if (route.name !== destination.name) return false;
    const current = route.params as Readonly<Record<string, unknown>> | undefined;
    return identity.every((key) => current?.[key] === params[key]);
  });
  return {
    ...state,
    index: reviewers ? 2 : 1,
    routes: [
      home,
      { ...existing, ...destination },
      ...(reviewers ? [{ name: "PullRequestReviewers", params: reviewers }] : []),
    ],
  };
}

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
