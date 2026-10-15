import { useNavigation, useNavigationState, useRoute } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Platform, View } from "react-native";

import { useWorkspaceTabs } from "../../workspace/WorkspaceTabsContext";
import type { ScreenHeaderProps } from "../../../components/ScreenHeader.types";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { MaterialScreenContent as SettingsScreenContent } from "../../../components/MaterialScreenContent";

export { SettingsScreenContent };

export function SettingsScreen(
  props: Pick<ScreenHeaderProps, "title" | "actions" | "trailing"> & {
    readonly children: ReactNode;
    /** A native form sheet already owns its rounded outer frame. */
    readonly formSheet?: boolean;
  },
) {
  const navigation = useNavigation();
  const route = useRoute();
  const index = useNavigationState((state) => state.index);
  const workspace = useWorkspaceTabs();
  const workspaceRoot =
    Platform.OS === "android" && workspace !== null && index === 0 && route.name === "Settings";

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <ScreenHeader
        title={props.title}
        actions={props.actions}
        trailing={Platform.OS === "android" ? props.trailing : undefined}
        sidebar={false}
        onBack={workspaceRoot ? undefined : () => navigation.goBack()}
        hideBottomBorder={!props.formSheet}
      />
      {props.formSheet ? (
        props.children
      ) : (
        <SettingsScreenContent>{props.children}</SettingsScreenContent>
      )}
    </View>
  );
}
