import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { updateFabScroll } from "../home/fab-scroll";

const CHROME_TIMING = { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) };

interface CompactWorkspaceChrome {
  /** 0 while the header and bottom bar show, 1 once they have scrolled away. */
  readonly hidden: SharedValue<number>;
  /** Whether the chrome is showing; the New thread FAB extends and shrinks with it. */
  readonly expanded: boolean;
  /** The window's bottom inset, which the content no longer sees under the bottom bar. */
  readonly bottomInset: number;
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  readonly onScrollBeginDrag: () => void;
  readonly onScrollEndDrag: () => void;
}

const CompactWorkspaceChromeContext = createContext<CompactWorkspaceChrome | null>(null);

/**
 * Phone lists hide their header and the bottom bar while scrolling down and bring
 * them back on the first scroll up, on the same cue that collapses the New thread FAB.
 * The bars only move while no finger is on the list: moving them changes the list's
 * layout, and under a dragging finger that reads as a scroll the other way and flips
 * them straight back. Changing `resetKey` (the selected tab) shows the chrome again.
 */
export function CompactWorkspaceChromeProvider(props: {
  readonly resetKey: string;
  readonly bottomInset: number;
  readonly children: ReactNode;
}) {
  const hidden = useSharedValue(0);
  const [expanded, setExpanded] = useState(true);
  const scrollState = useRef({ anchor: 0, expanded: true });
  const dragging = useRef(false);
  const shown = useRef(true);
  const show = useCallback(
    (next: boolean) => {
      if (shown.current === next) return;
      shown.current = next;
      hidden.value = withTiming(next ? 0 : 1, CHROME_TIMING);
    },
    [hidden],
  );
  useEffect(() => {
    scrollState.current = { anchor: 0, expanded: true };
    dragging.current = false;
    shown.current = true;
    hidden.value = withTiming(0, CHROME_TIMING);
    setExpanded(true);
  }, [hidden, props.resetKey]);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = updateFabScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );
      if (next.expanded !== scrollState.current.expanded) setExpanded(next.expanded);
      scrollState.current = next;
      if (!dragging.current) show(next.expanded);
    },
    [show],
  );
  const onScrollBeginDrag = useCallback(() => {
    dragging.current = true;
  }, []);
  const onScrollEndDrag = useCallback(() => {
    dragging.current = false;
    show(scrollState.current.expanded);
  }, [show]);
  return (
    <CompactWorkspaceChromeContext
      value={{
        hidden,
        expanded,
        bottomInset: props.bottomInset,
        onScroll,
        onScrollBeginDrag,
        onScrollEndDrag,
      }}
    >
      {props.children}
    </CompactWorkspaceChromeContext>
  );
}

export function useCompactWorkspaceChrome() {
  return use(CompactWorkspaceChromeContext);
}

/**
 * Slides a list header up behind the status bar as the chrome hides, so the list's
 * rounded top pushes it off screen. The status bar strip itself stays in place. The
 * header is laid out absolutely so it keeps its natural height while clipped.
 */
export function CompactWorkspaceHeader(props: { readonly children: ReactNode }) {
  const chrome = useCompactWorkspaceChrome();
  const insets = useSafeAreaInsets();
  const { scale } = useAndroidControlSizing();
  const measured = useSharedValue(0);
  const hidden = chrome?.hidden;
  const clipStyle = useAnimatedStyle(() => ({
    height: measured.value * (1 - (hidden?.value ?? 0)),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden ? -measured.value * hidden.value : 0 }],
  }));
  if (!chrome) return props.children;
  // Toolbars pad by max(top inset, 12dp); the strip keeps the part above that 12dp.
  const statusStrip = Math.max(0, insets.top - 12 * scale);
  return (
    <>
      <Animated.View className="bg-header" style={{ height: statusStrip }} />
      <Animated.View className="overflow-hidden bg-header" style={clipStyle}>
        <Animated.View
          className="absolute inset-x-0 top-0"
          style={contentStyle}
          onLayout={(event) => {
            measured.value = event.nativeEvent.layout.height;
          }}
        >
          <SafeAreaInsetsContext value={{ ...insets, top: 0 }}>
            {props.children}
          </SafeAreaInsetsContext>
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** Lets the bottom bar drop off the bottom of the screen as the chrome hides. */
export function CompactWorkspaceBottomBar(props: { readonly children: ReactNode }) {
  const chrome = useCompactWorkspaceChrome();
  const measured = useSharedValue(0);
  const hidden = chrome?.hidden;
  const clipStyle = useAnimatedStyle(() => ({
    height: measured.value * (1 - (hidden?.value ?? 0)),
  }));
  if (!chrome) return props.children;
  return (
    <Animated.View className="overflow-hidden" style={clipStyle}>
      <Animated.View
        className="absolute inset-x-0 top-0"
        onLayout={(event) => {
          measured.value = event.nativeEvent.layout.height;
        }}
      >
        {props.children}
      </Animated.View>
    </Animated.View>
  );
}
