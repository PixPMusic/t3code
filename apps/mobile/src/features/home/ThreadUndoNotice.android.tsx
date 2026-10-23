import { use, useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "../../components/ui/Toast";
import {
  dismissThreadUndoNotice,
  readThreadUndoNotice,
  useThreadUndoNotice,
} from "./thread-undo-notice";
import { ThreadUndoNoticeHeightContext } from "./thread-undo-notice-layout";

const SWIPE_TIMING = { duration: 160, reduceMotion: ReduceMotion.System };

export function ThreadUndoNotice(props: { readonly visible: boolean }) {
  const notice = useThreadUndoNotice();
  // Replacing a notice must also cancel the native gesture tracking the old one.
  const [instance, setInstance] = useState({ notice, key: 0 });
  if (instance.notice !== notice) setInstance({ notice, key: instance.key + 1 });
  if (!props.visible || notice === null) return null;
  return <SwipeableUndoNotice key={instance.key} notice={notice} />;
}

function SwipeableUndoNotice(props: {
  readonly notice: NonNullable<ReturnType<typeof useThreadUndoNotice>>;
}) {
  const { notice } = props;
  const insets = useSafeAreaInsets();
  const setHeight = use(ThreadUndoNoticeHeightContext);
  const translation = useSharedValue(0);
  const width = useSharedValue(0);

  useLayoutEffect(
    () => () => {
      cancelAnimation(translation);
      setHeight?.(0);
    },
    [setHeight, translation],
  );

  const dismiss = () => {
    // A newer action can replace the notice while the swipe is animating out.
    if (readThreadUndoNotice() === notice) dismissThreadUndoNotice();
  };
  const gesture = usePanGesture({
    activeOffsetX: [-10, 10],
    failOffsetY: [-12, 12],
    onUpdate: (event) => {
      translation.set(event.translationX);
    },
    onDeactivate: (event) => {
      if (
        !event.canceled &&
        (Math.abs(event.translationX) > width.value * 0.25 ||
          (Math.abs(event.velocityX) > 800 && event.translationX * event.velocityX > 0))
      ) {
        const direction = Math.sign(event.translationX || event.velocityX);
        translation.set(
          withTiming(direction * (width.value + 24), SWIPE_TIMING, (finished) => {
            if (finished) runOnJS(dismiss)();
          }),
        );
      } else {
        translation.set(withTiming(0, SWIPE_TIMING));
      }
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value }],
  }));

  return (
    <View
      className="absolute inset-x-3 z-[100]"
      style={{ bottom: insets.bottom + 12 }}
      pointerEvents="box-none"
      onLayout={(event) => {
        width.set(event.nativeEvent.layout.width);
        setHeight?.(event.nativeEvent.layout.height);
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          style={animatedStyle}
          accessibilityActions={[{ name: "dismiss", label: "Dismiss message" }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "dismiss") dismiss();
          }}
        >
          <Toast
            message={`${notice.action} thread`}
            action={{ label: "Undo", onPress: () => void notice.undo() }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
