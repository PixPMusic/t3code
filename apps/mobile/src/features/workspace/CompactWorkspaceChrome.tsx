import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { updateFabScroll } from "../home/fab-scroll";

const CHROME_TIMING = { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) };
// Matches the list surface's rounded-t-[28px].
const SURFACE_RADIUS = 28;

interface CompactWorkspaceChrome {
  /** 0 while the header and bottom bar show, 1 once they have scrolled away. */
  readonly hidden: SharedValue<number>;
  /** Whether the chrome is showing; the New thread FAB extends and shrinks with it. */
  readonly expanded: boolean;
  /** Lists pad their content by these so nothing starts under the floating bars. */
  readonly headerHeight: number;
  readonly barHeight: number;
  readonly barHeightValue: SharedValue<number>;
  /** The window's bottom inset, which the content no longer sees under the bottom bar. */
  readonly bottomInset: number;
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onScrollBeginDrag: () => void;
  readonly setHeaderHeight: (height: number) => void;
  readonly setBarHeight: (height: number) => void;
}

const CompactWorkspaceChromeContext = createContext<CompactWorkspaceChrome | null>(null);

/**
 * Phone lists hide their header and the bottom bar while scrolling down and bring
 * them back on the first scroll up, on the same cue that collapses the New thread FAB.
 * Both bars float over a list that never moves: a list that shifted under a dragging
 * finger would read the shift as a scroll the other way and flip the bars back.
 * Changing `resetKey` (the selected tab) shows the chrome again. Until the list is
 * dragged after that, scroll events only move the anchor, so restoring a tab's saved
 * position doesn't read as a scroll down and hide the bars.
 */
export function CompactWorkspaceChromeProvider(props: {
  readonly resetKey: string;
  readonly bottomInset: number;
  readonly children: ReactNode;
}) {
  const hidden = useSharedValue(0);
  const barHeightValue = useSharedValue(0);
  const [expanded, setExpanded] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [barHeight, setBarHeightState] = useState(0);
  const scrollState = useRef({ anchor: 0, expanded: true });
  const dragged = useRef(false);
  useEffect(() => {
    scrollState.current = { anchor: 0, expanded: true };
    dragged.current = false;
    hidden.value = withTiming(0, CHROME_TIMING);
    setExpanded(true);
  }, [hidden, props.resetKey]);
  const setBarHeight = useCallback(
    (height: number) => {
      barHeightValue.value = height;
      setBarHeightState(height);
    },
    [barHeightValue],
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (!dragged.current) {
        scrollState.current = { anchor: Math.max(0, contentOffset.y), expanded: true };
        return;
      }
      const next = updateFabScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );
      if (next.expanded !== scrollState.current.expanded) {
        hidden.value = withTiming(next.expanded ? 0 : 1, CHROME_TIMING);
        setExpanded(next.expanded);
      }
      scrollState.current = next;
    },
    [hidden],
  );
  const onScrollBeginDrag = useCallback(() => {
    dragged.current = true;
  }, []);
  return (
    <CompactWorkspaceChromeContext
      value={{
        hidden,
        expanded,
        headerHeight,
        barHeight,
        barHeightValue,
        bottomInset: props.bottomInset,
        onScroll,
        onScrollBeginDrag,
        setHeaderHeight,
        setBarHeight,
      }}
    >
      {props.children}
    </CompactWorkspaceChromeContext>
  );
}

export function useCompactWorkspaceChrome() {
  return use(CompactWorkspaceChromeContext);
}

/** Paints the header colour outside one rounded top corner of the list surface. */
function SurfaceCorner(props: { readonly side: "left" | "right"; readonly color: string }) {
  const band = 16;
  return (
    <View style={{ width: SURFACE_RADIUS, height: SURFACE_RADIUS, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          top: -band,
          [props.side]: -band,
          width: 2 * (SURFACE_RADIUS + band),
          height: 2 * (SURFACE_RADIUS + band),
          borderRadius: SURFACE_RADIUS + band,
          borderWidth: band,
          borderColor: props.color,
        }}
      />
    </View>
  );
}

/**
 * Floats a list header over the list, with the list surface's rounded top corners
 * along its bottom edge. As the chrome hides, the header slides up behind the status
 * bar strip and the corners come to rest right under it.
 */
export function CompactWorkspaceHeader(props: { readonly children: ReactNode }) {
  const chrome = useCompactWorkspaceChrome();
  const insets = useSafeAreaInsets();
  const { scale } = useAndroidControlSizing();
  const { themeVariables } = useAppearancePreferences();
  const hidden = chrome?.hidden;
  const headerHeight = chrome?.headerHeight ?? 0;
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden ? -headerHeight * hidden.value : 0 }],
  }));
  if (!chrome) return props.children;
  // Toolbars pad by max(top inset, 12dp); the strip keeps the part above that 12dp.
  const statusStrip = Math.max(0, insets.top - 12 * scale);
  const headerColor = themeVariables["--color-header"];
  return (
    <>
      <View className="bg-header" style={{ height: statusStrip }} />
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: statusStrip,
          left: 0,
          right: 0,
          zIndex: 10,
          overflow: "hidden",
          height: headerHeight > 0 ? headerHeight + SURFACE_RADIUS : undefined,
        }}
      >
        <Animated.View pointerEvents="box-none" style={slideStyle}>
          <View
            className="bg-header"
            onLayout={(event) => chrome.setHeaderHeight(event.nativeEvent.layout.height)}
          >
            <SafeAreaInsetsContext value={{ ...insets, top: 0 }}>
              {props.children}
            </SafeAreaInsetsContext>
          </View>
          <View pointerEvents="none" className="flex-row justify-between">
            <SurfaceCorner side="left" color={headerColor} />
            <SurfaceCorner side="right" color={headerColor} />
          </View>
        </Animated.View>
      </View>
    </>
  );
}

/** Floats the bottom bar over the list and drops it off the bottom as the chrome hides. */
export function CompactWorkspaceBottomBar(props: { readonly children: ReactNode }) {
  const chrome = useCompactWorkspaceChrome();
  const hidden = chrome?.hidden;
  const barHeight = chrome?.barHeightValue;
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden && barHeight ? barHeight.value * hidden.value : 0 }],
  }));
  if (!chrome) return props.children;
  return (
    <Animated.View
      style={[{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 }, slideStyle]}
      onLayout={(event) => chrome.setBarHeight(event.nativeEvent.layout.height)}
    >
      {props.children}
    </Animated.View>
  );
}
