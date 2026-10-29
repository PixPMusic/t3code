import { use } from "react";
import { HeaderHeightContext } from "@react-navigation/elements";
import { useDeviceType } from "../../native/native-layout-metrics";
import { isDuoDevice } from "../../lib/device-type";
import { useNavigation } from "@react-navigation/native";
import type { EnvironmentId } from "@t3tools/contracts";
import { useServerConfigs } from "../../state/entities";
import { ListRow } from "../../components/ui/ListRow";
import { View } from "react-native";

export function HomeAgentLinks(props: { readonly environmentId?: EnvironmentId | null }) {
  const navigation = useNavigation();
  const deviceType = useDeviceType();
  const headerHeight = use(HeaderHeightContext) ?? 0;
  const configs = useServerConfigs();
  const homes = [...configs].filter(
    ([environmentId, config]) =>
      config.settings.home.threadId !== null &&
      (!props.environmentId || props.environmentId === environmentId),
  );
  if (homes.length === 0) return null;
  return (
    <View style={isDuoDevice(deviceType) ? { paddingTop: headerHeight } : undefined}>
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
    </View>
  );
}
