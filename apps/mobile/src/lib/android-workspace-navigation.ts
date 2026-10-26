import type { NavigationState } from "@react-navigation/native";
import { resetRootStack, type RootStackNavigation } from "./root-stack-reset";

const detailIdentity = {
  Thread: ["environmentId", "threadId"],
  PullRequest: ["environmentId", "projectId", "repository", "number", "host"],
} as const;

// Back returns to the detail a chat, PR, or subagent was opened from. A copy of the current
// detail directly below it, which confirming a Git action from the inline inspector can leave,
// is not a destination, so Back returns to the list instead.
function androidWorkspaceBackReturnsToDetail(state: NavigationState) {
  const current = state.routes[state.index];
  const previous = state.routes[state.index - 1];
  if (current?.name !== "Thread" && current?.name !== "PullRequest") return false;
  if (previous?.name === "PullRequestFile") return true;
  if (previous?.name !== "Thread" && previous?.name !== "PullRequest") return false;
  if (current.name !== previous.name) return true;
  const currentParams = current.params as Readonly<Record<string, unknown>> | undefined;
  const previousParams = previous.params as Readonly<Record<string, unknown>> | undefined;
  return detailIdentity[previous.name].some(
    (key) => currentParams?.[key] !== previousParams?.[key],
  );
}

/** The root stack with only the workspace list. */
export function androidWorkspaceNavigationState(state: NavigationState) {
  const home = state.routes.find((route) => route.name === "Home") ?? { name: "Home" };
  return { ...state, index: 0, routes: [home] };
}

export function resetAndroidWorkspace(navigation: RootStackNavigation) {
  resetRootStack(navigation, androidWorkspaceNavigationState);
}

export function parentThreadIsBelow(
  state: NavigationState,
  parent: ReactNavigation.RootParamList["Thread"],
) {
  if (!parent?.environmentId || !parent.threadId) return false;
  const previous = state.routes[state.index - 1];
  const params = previous?.params as ReactNavigation.RootParamList["Thread"] | undefined;
  return (
    previous?.name === "Thread" &&
    params?.environmentId === parent.environmentId &&
    params?.threadId === parent.threadId
  );
}

/**
 * How a thread link opened from inside a thread reaches its target. `navigate` would reuse the
 * current Thread route, so Back would skip the thread the link was in and land on the list.
 */
export function linkedThreadStep(
  state: NavigationState,
  target: ReactNavigation.RootParamList["Thread"],
): "stay" | "pop" | "push" {
  const params = state.routes[state.index]?.params as
    | ReactNavigation.RootParamList["Thread"]
    | undefined;
  if (
    state.routes[state.index]?.name === "Thread" &&
    params?.environmentId === target?.environmentId &&
    params?.threadId === target?.threadId
  ) {
    return "stay";
  }
  return parentThreadIsBelow(state, target) ? "pop" : "push";
}

export function returnToAndroidWorkspaceList(
  navigation: RootStackNavigation & { readonly goBack: () => void },
  selectTab: () => void,
) {
  const state = navigation.getState();
  if (state && androidWorkspaceBackReturnsToDetail(state)) return navigation.goBack();
  selectTab();
  resetAndroidWorkspace(navigation);
}

// In the split view these destinations swap the detail pane beside the sidebar instead of
// stacking over Home, so the default slide-in would show a layer that is not there.
export function androidWorkspaceDestinationAnimation(routeName: string, usesSplitView: boolean) {
  return usesSplitView && (routeName === "Thread" || routeName === "PullRequest")
    ? ("none" as const)
    : undefined;
}
