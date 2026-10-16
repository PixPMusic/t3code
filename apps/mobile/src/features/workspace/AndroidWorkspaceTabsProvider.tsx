import type { NavigationState } from "@react-navigation/native";
import { createContext, use, useLayoutEffect, type ReactNode } from "react";
import { Platform } from "react-native";
import { androidWorkspaceTabFromNavigationState } from "./android-workspace-tabs";
import { WorkspaceTabsProvider, useWorkspaceTabs } from "./WorkspaceTabsContext";
import { AndroidWorkspaceFiltersProvider } from "./AndroidWorkspaceFilters";

const AndroidWorkspaceRootStateContext = createContext<NavigationState | null>(null);

export function useAndroidWorkspaceRootState() {
  return use(AndroidWorkspaceRootStateContext);
}

function WorkspaceSelection(props: {
  readonly state: NavigationState;
  readonly children: ReactNode;
}) {
  const workspace = useWorkspaceTabs()!;
  const { dispatch } = workspace;
  const selected = androidWorkspaceTabFromNavigationState(props.state, workspace.state.selectedTab);
  useLayoutEffect(() => {
    dispatch({ type: "select", tab: selected });
  }, [dispatch, selected]);
  return props.children;
}

/** Android keeps one tab controller above the root navigator and split sidebar. */
export function AndroidWorkspaceTabsProvider(props: {
  readonly state: NavigationState;
  readonly children: ReactNode;
}) {
  return Platform.OS === "android" ? (
    <WorkspaceTabsProvider>
      <AndroidWorkspaceRootStateContext value={props.state}>
        <AndroidWorkspaceFiltersProvider>
          <WorkspaceSelection state={props.state}>{props.children}</WorkspaceSelection>
        </AndroidWorkspaceFiltersProvider>
      </AndroidWorkspaceRootStateContext>
    </WorkspaceTabsProvider>
  ) : (
    props.children
  );
}
