import { useCallback, useRef, useState, type ComponentProps } from "react";
import {
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NewThreadButton } from "../../components/NewThreadButton";
import type { AndroidHomeFabLayout as SharedAndroidHomeFabLayout } from "./AndroidHomeFab.shared";
import { useWorkspaceState } from "../../state/workspace";
import { FabScrollContext } from "./FabScrollContext";
import { updateFabScroll } from "./fab-scroll";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { useCompactWorkspaceChrome } from "../workspace/CompactWorkspaceChrome";

export function AndroidHomeFabLayout(props: ComponentProps<typeof SharedAndroidHomeFabLayout>) {
  const insets = useSafeAreaInsets();
  const { appearance } = useAppearancePreferences();
  const { fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const { state } = useWorkspaceState();
  const [expanded, setExpanded] = useState(true);
  const scrollState = useRef({ anchor: 0, expanded: true });
  const chrome = useCompactWorkspaceChrome();
  const chromeScroll = chrome?.onScroll;
  const chromeHidden = chrome?.hidden;
  const chromeBottomInset = chrome?.bottomInset ?? 0;
  const chromeBarHeight = chrome?.barHeightValue;
  // The list runs under the floating bottom bar: the FAB sits above the bar, then just
  // above the gesture area once the bar has dropped away.
  const fabStyle = useAnimatedStyle(() => {
    if (!chromeHidden || !chromeBarHeight) return { transform: [{ translateY: 0 }] };
    const hidden = chromeHidden.value;
    return {
      transform: [
        { translateY: -(chromeBarHeight.value * (1 - hidden) + chromeBottomInset * hidden) },
      ],
    };
  });
  // Where the phone chrome hides on scroll, the FAB follows its state so the two never disagree.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (chromeScroll) {
        chromeScroll(event);
        return;
      }
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = updateFabScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );
      if (next.expanded !== scrollState.current.expanded) setExpanded(next.expanded);
      scrollState.current = next;
    },
    [chromeScroll],
  );

  // Remount only the FAB when its font or pane changes to clear the cached expanded width.
  // It keeps Material's 16dp corner margin; the bottom bar already consumes the gesture inset.
  return (
    <View className="flex-1" onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}>
      <FabScrollContext value={onScroll}>{props.children}</FabScrollContext>
      {!props.disabled && !props.sidebar && state.hasConnections && layoutWidth !== null ? (
        <Animated.View pointerEvents="box-none" className="absolute inset-0" style={fabStyle}>
          <NewThreadButton
            key={`${appearance.baseFontSize}:${fontScale}:${layoutWidth}`}
            extended
            expanded={chrome ? chrome.expanded : expanded}
            onPress={props.onStartNewTask}
            className="absolute"
            style={{ right: 16, bottom: insets.bottom + 16 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
