import { requireNativeView } from "expo";
import type { NativeSyntheticEvent } from "react-native";
import { useScaledTextRole } from "../settings/appearance/useScaledTextRole";
import { NativeThemeHost } from "../../components/ui/NativeThemeHost.android";
import type { PullRequestMergeButtonProps } from "./PullRequestMergeButton";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { useControlTheme } from "../../components/ui/useControlTheme";

const NativeSplitButton = requireNativeView<{
  label: string;
  accessibilityLabel: string;
  enabled: boolean;
  loading: boolean;
  menuTitle: string;
  actions: { id: string; title: string; selected: boolean; enabled: boolean }[];
  fontSize: number;
  lineHeight: number;
  menuFontSize: number;
  menuLineHeight: number;
  scale: number;
  colors: {
    containerColor: string;
    contentColor: string;
    disabledContainerColor: string;
    disabledContentColor: string;
  };
  onButtonPressed: () => void;
  onActionSelected: (event: NativeSyntheticEvent<{ value: string }>) => void;
}>("T3SplitButton", "SplitButton");

export function PullRequestMergeButton(props: PullRequestMergeButtonProps) {
  const { colors } = useControlTheme();
  const typography = useScaledTextRole("footnote");
  const menuTypography = useScaledTextRole("body");
  const { scale } = useAndroidControlSizing();
  return (
    <NativeThemeHost
      matchContents={{ vertical: true }}
      ignoreSafeAreaKeyboardInsets
      style={{ width: "100%" }}
    >
      <NativeSplitButton
        label={props.label}
        accessibilityLabel={
          props.disabled || props.loading ? props.label : (props.accessibilityLabel ?? props.label)
        }
        enabled={!props.disabled}
        loading={props.loading}
        menuTitle={props.menuTitle}
        actions={props.actions.map((action) => ({
          id: action.id,
          title: action.title ?? "",
          selected: action.state === "on",
          enabled: !action.attributes?.disabled,
        }))}
        {...typography}
        menuFontSize={menuTypography.fontSize}
        menuLineHeight={menuTypography.lineHeight}
        scale={scale}
        colors={{
          containerColor: colors["--color-primary"],
          contentColor: colors["--color-primary-foreground"],
          disabledContainerColor: colors["--color-subtle-strong"],
          disabledContentColor: colors["--color-foreground-muted"],
        }}
        onButtonPressed={props.onPress}
        onActionSelected={({ nativeEvent }) => props.onSelectAction(nativeEvent.value)}
      />
    </NativeThemeHost>
  );
}
