import { StackActions, useNavigation } from "@react-navigation/native";
import { use } from "react";
import {
  ThreadInspectorNavigationContext,
  useOpenPullRequestInspector,
} from "../threads/thread-inspector-navigation";
import { Platform } from "react-native";

import { useSelectWorkspaceDetail } from "./workspace/useSelectWorkspaceDetail";
import type { WorkspaceDetail, WorkspaceDetailSheet } from "./workspace/workspace-detail-selection";

/**
 * Opens a thread or pull request from another page. Android shows one detail page at a time, so
 * it selects the detail; iOS pushes it over the current page, so Back returns there. A `sheet`
 * opens over the detail on Android and on its own over the current page on iOS.
 */
export function useOpenWorkspaceDetail() {
  const navigation = useNavigation();
  const selectDetail = useSelectWorkspaceDetail();
  const openPullRequestInspector = useOpenPullRequestInspector();
  const openInInspector = use(ThreadInspectorNavigationContext);
  return (detail: WorkspaceDetail, sheet?: WorkspaceDetailSheet) => {
    if (!sheet && navigation.getState()?.routes.at(-1)?.name === "PullRequestInspectorFullscreen") {
      if (detail.name === "PullRequest") {
        navigation.dispatch(StackActions.replace("PullRequestInspectorFullscreen", detail.params));
        return;
      }
      if (detail.params.environmentId && detail.params.threadId) {
        navigation.navigate("ThreadInspectorFullscreen", {
          environmentId: detail.params.environmentId,
          threadId: detail.params.threadId,
        });
        return;
      }
    }
    if (!sheet && detail.name === "PullRequest" && openPullRequestInspector(detail.params)) return;
    if (
      !sheet &&
      detail.name === "Thread" &&
      openInInspector &&
      detail.params.environmentId &&
      detail.params.threadId
    ) {
      openInInspector({
        type: "thread",
        environmentId: detail.params.environmentId,
        threadId: detail.params.threadId,
      });
      return;
    }
    if (Platform.OS === "android") selectDetail(detail, sheet);
    else if (sheet) navigation.navigate(sheet.name, sheet.params);
    else navigation.dispatch(StackActions.push(detail.name, detail.params));
  };
}
