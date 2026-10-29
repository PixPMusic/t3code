import { useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../../components/ui/AppText";
import { ListActionRow } from "../../components/ui/ListActionRow";
import { ListRowLayout } from "../../components/ui/ListRowLayout";
import { Menu } from "../../components/ui/Menu";
import { ScreenScrollView } from "../../components/ui/ScreenScrollView";
import { buildModelOptions, groupByProvider } from "../../lib/modelOptions";
import { useEnvironmentServerConfig } from "../../state/entities";
import { homeEnvironment } from "../../state/home";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  AndroidSettingsEnvironmentFilter,
  SettingsEnvironmentFilterHeader,
} from "./components/SettingsEnvironmentFilterHeader";
import { SettingsScreen } from "./components/SettingsScreen";
import { SettingsSection } from "./components/SettingsSection";
import { useSettingsEnvironmentFilter } from "./settings-environment-filter";

export function SettingsHomeRouteScreen() {
  const { selectedTargets } = useSettingsEnvironmentFilter();
  const insets = useSafeAreaInsets();
  return (
    <SettingsScreen title="Home" trailing={<AndroidSettingsEnvironmentFilter />}>
      <SettingsEnvironmentFilterHeader />
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 20 }}
      >
        <Text className="text-base text-foreground-muted">
          An agent for all your projects and linked environments. Home can start work, follow
          threads, and answer questions and approvals for you.
        </Text>
        {selectedTargets.map((target) => (
          <HomeEnvironmentSettings
            key={target.environmentId}
            environmentId={target.environmentId}
          />
        ))}
        {selectedTargets.length === 0 ? (
          <Text className="text-base text-foreground-muted">
            Connect an environment to set up Home.
          </Text>
        ) : null}
      </ScreenScrollView>
    </SettingsScreen>
  );
}

function HomeEnvironmentSettings(props: { readonly environmentId: EnvironmentId }) {
  const environmentId = props.environmentId;
  const navigation = useNavigation();
  const config = useEnvironmentServerConfig(environmentId);
  const canEnable = useAtomValue(homeEnvironment.enable.permissionAtom(environmentId));
  const canDisable = useAtomValue(homeEnvironment.disable.permissionAtom(environmentId));
  const canReset = useAtomValue(homeEnvironment.startFresh.permissionAtom(environmentId));
  const enable = useAtomCommand(homeEnvironment.enable, { reportFailure: false });
  const disable = useAtomCommand(homeEnvironment.disable, { reportFailure: false });
  const startFresh = useAtomCommand(homeEnvironment.startFresh, { reportFailure: false });
  const [picked, setPicked] = useState<ModelSelection | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const defaultSelection = config?.settings.defaultModelSelection;
  const supported = config?.homeWorkspaceRoot != null;
  const models = buildModelOptions(
    config,
    picked ?? defaultSelection ?? null,
    undefined,
    null,
  ).filter(
    (model) =>
      !model.isUnavailable &&
      !model.isHidden &&
      (!model.supportedRuntimeModes || model.supportedRuntimeModes.includes("full-access")),
  );
  const chosen =
    models.find(
      (model) =>
        model.selection.instanceId === (picked ?? defaultSelection)?.instanceId &&
        model.selection.model === (picked ?? defaultSelection)?.model,
    ) ?? models[0];
  const threadId = config?.settings.home.threadId ?? null;

  async function run(action: "enable" | "disable" | "reset") {
    if (inFlight.current || !supported || (action === "enable" && !chosen)) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    const result =
      action === "enable"
        ? await enable({ environmentId, input: { modelSelection: chosen!.selection } })
        : action === "reset"
          ? await startFresh({ environmentId, input: {} })
          : await disable({ environmentId, input: {} });
    setPending(false);
    inFlight.current = false;
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) {
        const cause = squashAtomCommandFailure(result);
        setError(cause instanceof Error ? cause.message : "Home could not be updated.");
      }
      return;
    }
    if (result.value && "threadId" in result.value)
      navigation.navigate("HomeAgent", { environmentId, threadId: result.value.threadId });
  }

  return (
    <View className="gap-3">
      <SettingsSection
        title={config?.environment.label ?? "Environment"}
        footer={threadId === null ? undefined : "Start fresh keeps Home’s notes and instructions."}
      >
        {!supported ? (
          <Text className="p-4 text-base text-foreground-muted">
            Update this environment to use Home.
          </Text>
        ) : threadId === null ? (
          <>
            <Menu
              actions={groupByProvider(models).map((group) => ({
                id: group.providerKey,
                title: group.providerLabel,
                subactions: group.models.map((model) => ({
                  id: model.key,
                  title: model.label,
                  state: model.key === chosen?.key ? ("on" as const) : ("off" as const),
                })),
              }))}
              onPressAction={({ nativeEvent }) => {
                const model = models.find((candidate) => candidate.key === nativeEvent.event);
                if (model) setPicked(model.selection);
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Home model, ${chosen?.label ?? "No models available"}`}
                disabled={pending || !canEnable}
                className="bg-grouped-card"
              >
                <ListRowLayout label="Model" detail={chosen?.label ?? "No models available"} />
              </Pressable>
            </Menu>
            <ListActionRow
              label="Turn on Home"
              icon="house"
              disabled={pending || !canEnable || !chosen}
              loading={pending}
              onPress={() => void run("enable")}
            />
          </>
        ) : (
          <>
            <ListActionRow
              label="Open Home"
              icon="house"
              onPress={() => navigation.navigate("HomeAgent", { environmentId, threadId })}
            />
            <ListActionRow
              label="Start fresh"
              icon="arrow.clockwise"
              disabled={pending || !canReset}
              loading={pending}
              onPress={() => void run("reset")}
            />
            <ListActionRow
              label="Turn off Home"
              icon="stop.fill"
              tone="danger"
              disabled={pending || !canDisable}
              onPress={() => void run("disable")}
            />
          </>
        )}
      </SettingsSection>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger-foreground">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
