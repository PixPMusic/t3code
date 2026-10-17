import {
  CommonActions,
  useNavigation,
  type NavigationAction,
  type NavigationState,
} from "@react-navigation/native";
import { useCallback } from "react";
import { Keyboard } from "react-native";
import {
  androidWorkspaceNavigationState,
  type AndroidWorkspaceDestination,
} from "../../lib/android-workspace-navigation";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";

/**
 * The sidebar and navigation rail sit in the root layout, where a state-callback dispatch goes
 * to the focused navigator. While a nested flow such as New thread has focus, that navigator has
 * no Home or Thread route and drops the reset, so address the root stack by its key.
 */
interface WorkspaceNavigation {
  getParent(): WorkspaceNavigation | undefined;
  getState(): NavigationState | undefined;
  dispatch(action: NavigationAction): void;
}

export function resetAndroidWorkspace(
  navigation: WorkspaceNavigation,
  next: (state: NavigationState) => Parameters<typeof CommonActions.reset>[0],
) {
  let root = navigation;
  for (let parent = root.getParent(); parent; parent = parent.getParent()) root = parent;
  const state = root.getState();
  if (state) root.dispatch({ ...CommonActions.reset(next(state)), target: state.key });
}

export function useAndroidWorkspaceSelection() {
  const navigation = useNavigation();
  const dispatch = useWorkspaceTabs()?.dispatch;
  return useCallback(
    (
      destination: AndroidWorkspaceDestination,
      reviewers?: ReactNavigation.RootParamList["PullRequestReviewers"],
    ) => {
      Keyboard.dismiss();
      dispatch?.({
        type: "select",
        tab: destination.name === "Thread" ? "threads" : "pullRequests",
      });
      resetAndroidWorkspace(navigation, (state) =>
        androidWorkspaceNavigationState(state, destination, reviewers),
      );
    },
    [navigation, dispatch],
  );
}
