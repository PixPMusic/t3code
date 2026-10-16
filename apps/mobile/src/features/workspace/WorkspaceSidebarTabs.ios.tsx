import { StackActions, useNavigation } from "@react-navigation/native";
import { Keyboard, View } from "react-native";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";
import type { WorkspaceTab } from "./workspace-tabs-state";

/** Wide iPad navigation belongs to the sidebar, leaving the detail's header unobstructed. */
export function WorkspaceSidebarTabs() {
  const workspace = useWorkspaceTabs()!;
  const navigation = useNavigation();
  return (
    <View className="px-4 pb-3 pt-2">
      <SegmentedControl
        // Each tab retains its own copy of this picker. SwiftUI keeps the
        // segment last tapped in a hidden copy, and re-rendering the same
        // selection does not reset it, so remount on every tab switch.
        key={workspace.state.selectionRevision}
        role="tab"
        options={[
          { value: "threads", label: "Threads" },
          { value: "pullRequests", label: "Pull requests" },
        ]}
        selected={workspace.state.selectedTab}
        onSelect={(tab: WorkspaceTab) => {
          if (tab === workspace.state.selectedTab) return;
          Keyboard.dismiss();
          if (navigation.getState()?.index) navigation.dispatch(StackActions.popToTop());
          workspace.dispatch({ type: "select", tab });
        }}
      />
    </View>
  );
}
