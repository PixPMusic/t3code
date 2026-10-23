import { useCallback, useRef, useState, type ComponentProps } from "react";
import {
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewThreadButton } from "../../components/NewThreadButton";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import {
  androidHomeFabPosition,
  type AndroidHomeFabLayout as SharedAndroidHomeFabLayout,
} from "./AndroidHomeFab.shared";
import { useWorkspaceState } from "../../state/workspace";
import { FabScrollContext } from "./FabScrollContext";
import { updateFabScroll } from "./fab-scroll";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { ThreadUndoNoticeBottomContext } from "./thread-undo-notice-layout";

export function AndroidHomeFabLayout(props: ComponentProps<typeof SharedAndroidHomeFabLayout>) {
  const insets = useSafeAreaInsets();
  const { appearance } = useAppearancePreferences();
  const { fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const { fabSize } = useAndroidControlSizing();
  const { state } = useWorkspaceState();
  const [expanded, setExpanded] = useState(true);
  const scrollState = useRef({ anchor: 0, expanded: true });
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = updateFabScroll(
      scrollState.current,
      contentOffset.y,
      contentSize.height - layoutMeasurement.height,
    );
    if (next.expanded !== scrollState.current.expanded) setExpanded(next.expanded);
    scrollState.current = next;
  }, []);
  const showFab = !props.disabled && !props.sidebar && state.hasConnections && layoutWidth !== null;
  const fabPosition = androidHomeFabPosition(insets.bottom, props.sidebar);

  // Remount only the FAB when its font or pane changes to clear the cached expanded width.
  // The split-view sidebar has no FAB: the navigation rail carries New thread. On phones it
  // keeps Material's 16dp corner margin; the bottom bar already consumes the gesture inset.
  return (
    <View className="flex-1" onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}>
      <ThreadUndoNoticeBottomContext value={showFab ? fabPosition.bottom + fabSize + 12 : null}>
        <FabScrollContext value={onScroll}>{props.children}</FabScrollContext>
      </ThreadUndoNoticeBottomContext>
      {showFab ? (
        <NewThreadButton
          key={`${appearance.baseFontSize}:${fontScale}:${layoutWidth}`}
          extended
          expanded={expanded}
          onPress={props.onStartNewTask}
          className="absolute"
          style={fabPosition}
        />
      ) : null}
    </View>
  );
}
