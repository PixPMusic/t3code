import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useScaledTextRole } from "../../features/settings/appearance/useScaledTextRole";
import { useAndroidControlSizing } from "./useAndroidControlSizing";

/**
 * Shared Android header geometry; class-based spacing uses the app's 14dp rem.
 * `singleLine` sizes the toolbar for a title row with the subtitle inline.
 */
export function useToolbarLayout(embedded = false, singleLine = false) {
  const insets = useSafeAreaInsets();
  const title = useScaledTextRole("title");
  const subtitle = useScaledTextRole("label");
  const { scale } = useAndroidControlSizing();
  return {
    height: Math.ceil(
      singleLine
        ? Math.max(48, 48 * scale, title.lineHeight + 1)
        : Math.max(48, 56 * scale, title.lineHeight + subtitle.lineHeight + 1),
    ),
    paddingTop: embedded ? 8 * scale : Math.max(insets.top, 12 * scale),
    paddingBottom: 7 * scale,
  };
}
