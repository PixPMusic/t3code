import {
  StackActions,
  useFocusEffect,
  useNavigation,
  type StaticScreenProps,
} from "@react-navigation/native";
import { useCallback } from "react";
import { EnvironmentId } from "@t3tools/contracts";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useEnvironmentServerConfig } from "../../state/entities";
import { resetAndroidWorkspace } from "../../lib/android-workspace-navigation";
import { useWindowDimensions } from "react-native";
import {
  deriveFileInspectorPaneLayout,
  deriveLayout,
  deriveWorkspacePaneLayout,
} from "../../lib/layout";
import {
  NativePrimaryColumnContext,
  NativeWorkspaceModeContext,
} from "../../native/v5-workspace-context";
import {
  AdaptiveWorkspaceContext,
  useAdaptiveWorkspaceLayout,
} from "../layout/adaptive-workspace-context";
import { InspectorContentScope } from "../threads/thread-inspector-preview";
import { ThreadRouteScreen } from "../threads/ThreadRouteScreen";
import { useWorkspaceTabs } from "../workspace/WorkspaceTabsContext";

const layout = deriveLayout({ width: 0, height: 0 });
const fileInspector = deriveFileInspectorPaneLayout({ layout, viewportWidth: 0 });
const ignore = () => undefined;
const register = () => ignore;

export function HomeAgentRouteScreen(
  props: StaticScreenProps<{
    readonly environmentId: string;
    readonly threadId: string;
  }>,
) {
  const workspace = useAdaptiveWorkspaceLayout();
  const navigation = useNavigation();
  const tabs = useWorkspaceTabs();
  const config = useEnvironmentServerConfig(EnvironmentId.make(props.route.params.environmentId));
  const configuredThreadId = config?.settings.home.threadId;
  useFocusEffect(
    useCallback(() => {
      if (configuredThreadId === undefined) return;
      if (configuredThreadId === null) {
        tabs?.dispatch({ type: "select", tab: "home" });
        resetAndroidWorkspace(navigation);
      } else if (configuredThreadId !== props.route.params.threadId) {
        navigation.dispatch(
          StackActions.replace("HomeAgent", {
            ...props.route.params,
            threadId: configuredThreadId,
          }),
        );
      }
    }, [configuredThreadId, navigation, props.route.params, tabs]),
  );
  const { width } = useWindowDimensions();
  const panes = deriveWorkspacePaneLayout({
    layout,
    viewportWidth: width,
    primarySidebarPreferredVisible: false,
    auxiliaryPanePreferredVisible: false,
  });
  if (configuredThreadId !== undefined && configuredThreadId !== props.route.params.threadId)
    return <LoadingScreen message="Opening Home…" />;
  return (
    <NativeWorkspaceModeContext value={false}>
      <NativePrimaryColumnContext value={null}>
        <AdaptiveWorkspaceContext
          value={{
            ...workspace,
            layout,
            panes,
            fileInspector,
            selectDetail: undefined,
            activateAuxiliaryPaneRole: register,
            registerWorkspaceInspector: register,
            showAuxiliaryPane: ignore,
            toggleAuxiliaryPane: ignore,
            togglePrimarySidebar: ignore,
            setPrimarySidebarVisible: ignore,
            setComposerEditing: ignore,
            composerKeyboardActive: false,
            sidebarByOrientation: null,
          }}
        >
          <InspectorContentScope>
            <ThreadRouteScreen {...props} />
          </InspectorContentScope>
        </AdaptiveWorkspaceContext>
      </NativePrimaryColumnContext>
    </NativeWorkspaceModeContext>
  );
}
