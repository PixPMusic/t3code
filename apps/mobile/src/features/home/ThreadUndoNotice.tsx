import { useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "../../components/ui/Toast";
import { useNativeColumnLayoutMetrics } from "../../native/native-layout-metrics";
import { useWorkspaceTabs } from "../workspace/WorkspaceTabsContext";
import {
  dismissThreadUndoNotice,
  readThreadUndoNotice,
  useThreadUndoNotice,
} from "./thread-undo-notice";

export function ThreadUndoNotice(props: { readonly visible: boolean }) {
  const notice = useThreadUndoNotice();
  const insets = useSafeAreaInsets();
  const columnMetrics = useNativeColumnLayoutMetrics();
  const workspace = useWorkspaceTabs();
  // Replacing a notice must also cancel the native gesture tracking the old one.
  const [instance, setInstance] = useState({ notice, key: 0 });
  if (instance.notice !== notice) setInstance({ notice, key: instance.key + 1 });
  if (!props.visible || notice === null) return null;
  const bottom =
    Platform.OS === "ios"
      ? Math.max(
          insets.bottom,
          columnMetrics?.safeArea.bottom ?? 0,
          workspace?.bottomClearance ?? 0,
        )
      : insets.bottom;
  return (
    <View
      key={instance.key}
      collapsable={false}
      className="absolute inset-x-3 z-[100]"
      style={{ bottom: bottom + 12 }}
      pointerEvents="box-none"
    >
      <Toast
        message={`${notice.action} thread`}
        action={{
          label: "Undo",
          onPress: () => {
            void notice.undo();
          },
        }}
        dismissMode="swipe"
        onDismiss={() => {
          // A newer action can replace the notice while the swipe is animating out.
          if (readThreadUndoNotice() === notice) dismissThreadUndoNotice();
        }}
      />
    </View>
  );
}
