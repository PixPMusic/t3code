import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { View } from "react-native";
import { HomeAgentAppBar } from "./HomeAgentTitle";

import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingScreen } from "../../components/LoadingScreen";
import { rootNavigationRef, whenRootNavigationReady } from "../../lib/rootNavigation";
import { useServerConfigs } from "../../state/entities";
import { useWorkspaceEnvironments } from "../../state/workspace";
import { openSettings } from "../settings/settings-navigation";
import { currentWorkspaceSelections } from "../workspace/workspace-selection-store";
import { useSelectWorkspaceTab } from "../workspace/useSelectWorkspaceTab";
import { useWorkspaceTabs } from "../workspace/WorkspaceTabsContext";
import { resolveHomeEnvironment } from "./resolve-home-environment";

export function HomeTabScreen() {
  const navigation = useNavigation();
  const workspace = useWorkspaceTabs()!;
  const selectTab = useSelectWorkspaceTab();
  const configs = useServerConfigs();
  const environments = useWorkspaceEnvironments();
  const source = resolveHomeEnvironment(
    environments.map((environment) => ({
      ...environment,
      threadId: configs.get(environment.environmentId)?.settings.home.threadId,
    })),
    currentWorkspaceSelections().home?.environmentId,
  );
  const threadId = source?.threadId;
  const disconnected = source !== undefined && source.connectionState !== "connected";
  useFocusEffect(
    useCallback(() => {
      if (!threadId) return;
      return whenRootNavigationReady(() => {
        if (rootNavigationRef.getCurrentRoute()?.name === "Home" && workspace.isTabActive("home"))
          selectTab("home");
      });
    }, [threadId, workspace, selectTab]),
  );
  const loading =
    threadId ||
    source?.connectionState === "connecting" ||
    source?.connectionState === "reconnecting" ||
    (source?.connectionState === "connected" && source.threadId === undefined);
  return (
    <>
      <HomeAgentAppBar environmentId={source?.environmentId} subtitle={source?.environmentLabel} />
      {loading ? (
        <LoadingScreen message="Opening Home…" embedded />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            title="Home"
            detail="One agent for your work across projects and connected environments."
            actionLabel={
              source ? (disconnected ? "Reconnect environment" : "Set up Home") : "Add environment"
            }
            onAction={() =>
              openSettings(
                navigation,
                source && !disconnected ? "SettingsHome" : "SettingsEnvironments",
              )
            }
            variant="plain"
          />
        </View>
      )}
    </>
  );
}
