import { requireNativeView } from "expo";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { androidWorkspaceTabNavigationState } from "../../lib/android-workspace-navigation";
import {
  Keyboard,
  processColor,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";

import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { useToolbarLayout } from "../../components/ui/useToolbarLayout";
import { androidWorkspaceNavigationColors } from "./android-workspace-navigation-colors";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { useWorkspaceConnectionState } from "../../state/workspace";
import { useAndroidWorkspaceRootState } from "./AndroidWorkspaceTabsProvider";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";
import type { WorkspaceTab } from "./workspace-tabs-state";

export const ANDROID_WORKSPACE_RAIL_WIDTH = 96;

interface NativeNavigationProps extends ViewProps {
  readonly safeAreaTop: number;
  readonly headerHeight: number;
  readonly newEnabled: boolean;
  readonly actionColor: number;
  readonly actionContentColor: number;
  readonly rail: boolean;
  readonly selectedTab: WorkspaceTab;
  readonly dark: boolean;
  readonly textScale: number;
  readonly containerColor: number;
  readonly selectedColor: number;
  readonly indicatorColor: number;
  readonly unselectedColor: number;
  readonly onTabSelected: (event: NativeSyntheticEvent<{ readonly tab: WorkspaceTab }>) => void;
  readonly onNewThread: () => void;
}

const NativeNavigation = requireNativeView<NativeNavigationProps>("T3WorkspaceNavigation");

function nativeColor(value: string) {
  const color = processColor(value);
  return typeof color === "number" ? color : 0;
}

export function AndroidWorkspaceNavigation(props: {
  readonly rail?: boolean;
  readonly onSelect?: () => void;
}) {
  const workspace = useWorkspaceTabs()!;
  const rootState = useAndroidWorkspaceRootState();
  const connectionState = useWorkspaceConnectionState();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // The rail menu shares the list toolbar geometry so both rows line up.
  const toolbar = useToolbarLayout();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const { themeAppearance, themeVariables: colors } = useAppearancePreferences();
  const { scale } = useAndroidControlSizing();
  const rail = Boolean(props.rail);
  const { containerColor, indicatorColor, selectedColor, unselectedColor } =
    androidWorkspaceNavigationColors(colors, rail);
  if (!rail && keyboardVisible) return null;

  return (
    <View
      style={{
        backgroundColor: containerColor,
        ...(rail
          ? {
              flex: 1,
              width: ANDROID_WORKSPACE_RAIL_WIDTH,
              paddingTop: toolbar.paddingTop,
              paddingBottom: insets.bottom,
            }
          : { paddingBottom: insets.bottom }),
      }}
    >
      <NativeNavigation
        safeAreaTop={toolbar.paddingTop}
        headerHeight={toolbar.height}
        newEnabled={connectionState.hasConnections}
        actionColor={nativeColor(colors["--color-primary"])}
        actionContentColor={nativeColor(colors["--color-primary-foreground"])}
        rail={rail}
        selectedTab={workspace.state.selectedTab}
        dark={themeAppearance === "dark"}
        textScale={scale}
        containerColor={nativeColor(containerColor)}
        selectedColor={nativeColor(selectedColor)}
        indicatorColor={nativeColor(indicatorColor)}
        unselectedColor={nativeColor(unselectedColor)}
        onTabSelected={(event) => {
          Keyboard.dismiss();
          const tab = event.nativeEvent.tab;
          if (tab !== workspace.state.selectedTab) {
            if (tab === "threads" || tab === "pullRequests") {
              workspace.dispatch({ type: "select", tab });
            }
            if (rootState) {
              // Reset the workspace stack, even when a nested settings navigator has focus.
              navigation.dispatch({
                ...CommonActions.reset(androidWorkspaceTabNavigationState(rootState, tab)),
                target: rootState.key,
              });
            }
          }
          props.onSelect?.();
        }}
        onNewThread={() => {
          Keyboard.dismiss();
          navigation.navigate("NewTaskSheet", { screen: "NewTask" });
        }}
        style={rail ? { flex: 1 } : { height: 80 * Math.max(1, scale) }}
      />
    </View>
  );
}
