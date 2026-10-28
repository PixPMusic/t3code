import { PullRequestGlyph } from "./pullRequestGlyphs";
import type { MenuAction } from "@react-native-menu/menu";
import { Pressable, View } from "react-native";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { AppText } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Menu } from "../../components/ui/Menu";

export interface PullRequestMergeButtonProps {
  readonly label: string;
  readonly accessibilityLabel?: string;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly onPress: () => void;
  readonly menuTitle: string;
  readonly actions: (Pick<MenuAction, "title" | "state" | "image"> & {
    readonly id: string;
    readonly attributes?: { readonly disabled?: boolean };
  })[];
  readonly onSelectAction: (id: string) => void;
}

export function PullRequestMergeButton(props: PullRequestMergeButtonProps) {
  const active = !props.disabled;
  return (
    <View
      className={`flex-row overflow-hidden rounded-xl border-continuous ${active ? "bg-prominent-action" : "bg-subtle-strong"}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? props.label}
        accessibilityState={{ disabled: props.disabled, busy: props.loading }}
        disabled={props.disabled}
        onPress={props.onPress}
        className="min-h-11 min-w-0 flex-1 flex-row items-center justify-center gap-2 px-3 py-2 active:opacity-70"
      >
        {props.loading ? (
          <AppActivityIndicator size="small" colorClassName="accent-icon-muted" />
        ) : (
          <SymbolView
            name={PullRequestGlyph.merged}
            size={16}
            tintColorClassName={active ? "accent-prominent-action-foreground" : "accent-icon-muted"}
          />
        )}
        <AppText
          className={`shrink text-center text-sm font-t3-semibold ${active ? "text-prominent-action-foreground" : "text-foreground-muted"}`}
        >
          {props.label}
        </AppText>
      </Pressable>
      {props.actions.length > 0 ? (
        <Menu
          title={props.menuTitle}
          actions={props.actions}
          onPressAction={({ nativeEvent }) => props.onSelectAction(nativeEvent.event)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.menuTitle}
            className="min-h-11 w-11 items-center justify-center border-l border-border-subtle"
          >
            <SymbolView
              name="chevron.down"
              size={13}
              tintColorClassName={
                active ? "accent-prominent-action-foreground" : "accent-icon-muted"
              }
            />
          </Pressable>
        </Menu>
      ) : null}
    </View>
  );
}
