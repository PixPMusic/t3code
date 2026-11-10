import { StackActions, useNavigation } from "@react-navigation/native";
import { createContext, use } from "react";

import type { PullRequestParams } from "../pull-requests/usePullRequestDiff";

import { useWorkspacePaneState } from "../layout/AdaptiveWorkspaceLayout";

export type ThreadInspectorMode = "route" | "git" | "files" | "preview";

export type ThreadInspectorTarget =
  | {
      readonly type: "thread" | "device";
      readonly environmentId: string;
      readonly threadId: string;
      readonly deviceKey?: string;
    }
  | { readonly type: "pullRequest"; readonly params: PullRequestParams };

export const ThreadInspectorNavigationContext = createContext<
  ((target: ThreadInspectorTarget) => void) | null
>(null);

export function useOpenThreadInspector() {
  const navigation = useNavigation();
  const { fileInspector } = useWorkspacePaneState();
  const openInInspector = use(ThreadInspectorNavigationContext);
  return (
    source: { readonly environmentId: string; readonly threadId: string },
    target: ThreadInspectorTarget,
  ) => {
    if (!fileInspector.supported) return false;
    if (openInInspector) openInInspector(target);
    else {
      const parent = navigation.getState()?.routes.findLast((route) => route.name === "Thread");
      if (
        !parent?.params ||
        !("environmentId" in parent.params) ||
        parent.params.environmentId !== source.environmentId ||
        !("threadId" in parent.params) ||
        parent.params.threadId !== source.threadId
      )
        return false;
      navigation.dispatch(
        StackActions.popTo("Thread", { ...source, inspector: target }, { merge: true }),
      );
    }
    return true;
  };
}

export function useOpenPullRequestInspector() {
  const navigation = useNavigation();
  const open = useOpenThreadInspector();
  const openInInspector = use(ThreadInspectorNavigationContext);
  const { fileInspector } = useWorkspacePaneState();
  return (
    params: PullRequestParams,
    source?: { readonly environmentId: string; readonly threadId: string },
  ) => {
    if (!fileInspector.supported) return false;
    const target = { type: "pullRequest", params } as const;
    if (openInInspector) {
      openInInspector(target);
      return true;
    }
    const route = navigation.getState()?.routes.at(-1);
    if (!source || !route || !["Thread", "ThreadPullRequests", "GitOverview"].includes(route.name))
      return false;
    return open(source, target);
  };
}
