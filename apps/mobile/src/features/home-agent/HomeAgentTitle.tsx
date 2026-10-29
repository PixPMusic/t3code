import { useNavigation } from "@react-navigation/native";
import { Keyboard, Platform, Pressable, View } from "react-native";
import type { StackHeaderMenuIOS } from "react-native-screens";

import { AppText as Text } from "../../components/ui/AppText";
import { AppBar } from "../../components/ui/AppBar";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Menu } from "../../components/ui/Menu";
import { useServerConfigs } from "../../state/entities";
import { useWorkspaceEnvironments } from "../../state/workspace";
import { workspaceSelectionCheck } from "../workspace/workspace-selection-store";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { useScaledTextRole } from "../settings/appearance/useScaledTextRole";

export function useHomeAgentSwitcher(environmentId: string) {
  const navigation = useNavigation();
  const configs = useServerConfigs();
  const environments = useWorkspaceEnvironments();
  const homes = environments.filter(
    (environment) =>
      environment.isEnabled && configs.get(environment.environmentId)?.settings.home.threadId,
  );
  if (homes.length === 0 || (homes.length === 1 && homes[0]?.environmentId === environmentId))
    return null;
  const select = (environmentId: string) => {
    const target = workspaceSelectionCheck.home?.({ environmentId });
    if (!target || target.environmentId !== environmentId) return;
    Keyboard.dismiss();
    navigation.navigate("HomeAgent", target);
  };
  const actions = homes.map((environment) => ({
    id: String(environment.environmentId),
    title: environment.environmentLabel,
    subtitle: environment.connectionState === "connected" ? undefined : "Offline",
    state: environment.environmentId === environmentId ? ("on" as const) : ("off" as const),
  }));
  const menu: StackHeaderMenuIOS = {
    id: "home-environments",
    type: "menu",
    title: "Switch Home",
    children: actions.map((action) => ({
      ...action,
      type: "menuItem",
      itemType: "action",
      onPress: () => select(action.id),
    })),
  };
  return { menu, actions, select };
}

export function HomeAgentAppBar(props: {
  readonly environmentId?: string | undefined;
  readonly subtitle?: string | undefined;
}) {
  const switcher = useHomeAgentSwitcher(props.environmentId ?? "");
  const { themeVariables } = useAppearancePreferences();
  return (
    <AppBar
      title="Home"
      subtitle={props.subtitle}
      sidebar={false}
      options={{
        headerTitle: "Home",
        headerBackVisible: false,
        headerTitleMenu: switcher?.menu,
        ...(Platform.OS === "android"
          ? { contentStyle: { backgroundColor: themeVariables["--color-header"] } }
          : {}),
      }}
      hideBottomBorder
      optionsVersion={switcher?.menu}
      titleContent={
        switcher ? (
          <HomeAgentTitle title="Home" subtitle={props.subtitle ?? ""} switcher={switcher} />
        ) : undefined
      }
    />
  );
}

export function HomeAgentTitle(props: {
  readonly title: string;
  readonly subtitle: string;
  readonly switcher: NonNullable<ReturnType<typeof useHomeAgentSwitcher>>;
}) {
  const titleStyle = useScaledTextRole("title");
  const subtitleStyle = useScaledTextRole("label");
  return (
    <Menu
      title="Switch Home"
      actions={props.switcher.actions}
      onPressAction={({ nativeEvent }) => props.switcher.select(nativeEvent.event)}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Switch Home">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="text-header-foreground" style={titleStyle}>
            {props.title}
          </Text>
          <SymbolView name="chevron.down" size={12} tintColorClassName="accent-header-foreground" />
        </View>
        {props.subtitle ? (
          <Text numberOfLines={1} className="text-foreground-muted" style={subtitleStyle}>
            {props.subtitle}
          </Text>
        ) : null}
      </Pressable>
    </Menu>
  );
}
