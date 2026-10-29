import { useNavigation } from "@react-navigation/native";
import type { EnvironmentId } from "@t3tools/contracts";
import { useServerConfigs } from "../../state/entities";
import { ListRow } from "../../components/ui/ListRow";
import { View } from "react-native";

export function HomeAgentLinks(props: { readonly environmentId?: EnvironmentId | null }) {
  const navigation = useNavigation();
  const configs = useServerConfigs();
  const homes = [...configs].filter(
    ([environmentId, config]) =>
      config.settings.home.threadId !== null &&
      (!props.environmentId || props.environmentId === environmentId),
  );
  if (homes.length === 0) return null;
  return (
    <View className="mx-3 my-2 overflow-hidden rounded-2xl">
      {homes.map(([environmentId, config]) => (
        <ListRow
          key={environmentId}
          icon="house"
          label="Home"
          description={config.environment.label}
          onPress={() =>
            navigation.navigate("HomeAgent", {
              environmentId,
              threadId: config.settings.home.threadId!,
            })
          }
        />
      ))}
    </View>
  );
}
