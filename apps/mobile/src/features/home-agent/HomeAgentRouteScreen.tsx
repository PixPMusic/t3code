import type { StaticScreenProps } from "@react-navigation/native";
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
import { WorkspaceTabsContext } from "../workspace/WorkspaceTabsContext";

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
  const { width } = useWindowDimensions();
  const panes = deriveWorkspacePaneLayout({
    layout,
    viewportWidth: width,
    primarySidebarPreferredVisible: false,
    auxiliaryPanePreferredVisible: false,
  });
  return (
    <NativeWorkspaceModeContext value={false}>
      <NativePrimaryColumnContext value={null}>
        <WorkspaceTabsContext value={null}>
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
        </WorkspaceTabsContext>
      </NativePrimaryColumnContext>
    </NativeWorkspaceModeContext>
  );
}
