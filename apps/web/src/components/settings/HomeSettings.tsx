import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useOpenInPreferredEditor } from "../../editorPreferences";
import { useEnvironment } from "../../state/environments";
import { useQuietThreadShell } from "../../state/entities";
import { toastManager } from "../ui/toast";
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ModelSelection, ThreadId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useEnvironmentSettings } from "../../hooks/useSettings";
import {
  getCustomModelOptionsByInstance,
  resolveAppModelSelectionForInstance,
} from "../../modelSelection";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { homeEnvironment } from "../../state/home";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { Button } from "../ui/button";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  SETTINGS_PICKER_TRIGGER_CLASSNAME,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";

export function HomeSettings() {
  const { environments } = useSettingsScope();
  return (
    <SettingsPageContainer>
      {environments.length === 0 ? (
        <SettingsSection title="Home">
          <SettingsRow title="Home" description="Connect an environment to set up Home." />
        </SettingsSection>
      ) : (
        environments.map((environment) => (
          <SettingsSection
            key={environment.environmentId}
            title={environments.length > 1 ? `Home on ${environment.label}` : "Home"}
          >
            {environment.connection.phase !== "connected" ? (
              <SettingsRow
                title="Home"
                description={`Reconnect ${environment.label} to manage Home.`}
              />
            ) : environment.serverConfig?.homeWorkspaceRoot == null ? (
              <SettingsRow title="Home" description="Update this server to use Home." />
            ) : (
              <HomeEnvironmentSettings environmentId={environment.environmentId} />
            )}
          </SettingsSection>
        ))
      )}
    </SettingsPageContainer>
  );
}

function HomeEnvironmentSettings({ environmentId }: { environmentId: EnvironmentId }) {
  const settings = useEnvironmentSettings(environmentId);
  const environment = useEnvironment(environmentId);
  const homeThreadId = settings.home.threadId;
  const homeThread = useQuietThreadShell(
    homeThreadId ? scopeThreadRef(environmentId, homeThreadId) : null,
  );
  const availableEditors = environment?.serverConfig?.availableEditors ?? [];
  const homeWorkspaceRoot = environment?.serverConfig?.homeWorkspaceRoot;
  const openInEditor = useOpenInPreferredEditor(environmentId, availableEditors);
  const providers = useEnvironmentProviders().get(environmentId) ?? EMPTY_SERVER_PROVIDERS;
  const entries = providerInstanceEntriesFor(providers, settings, null);
  const enable = useAtomCommand(homeEnvironment.enable);
  const disable = useAtomCommand(homeEnvironment.disable);
  const startFresh = useAtomCommand(homeEnvironment.startFresh);
  const canEnable = useAtomValue(homeEnvironment.enable.permissionAtom(environmentId));
  const canDisable = useAtomValue(homeEnvironment.disable.permissionAtom(environmentId));
  const canStartFresh = useAtomValue(homeEnvironment.startFresh.permissionAtom(environmentId));
  const navigate = useNavigate();
  const [picked, setPicked] = useState<ModelSelection | null>(null);
  const [pending, setPending] = useState(false);
  const fallbackEntry = entries.find((entry) => entry.enabled && entry.isAvailable);
  const defaultSelection = settings.defaultModelSelection;
  const usableDefault =
    defaultSelection &&
    entries.some(
      (entry) =>
        entry.instanceId === defaultSelection.instanceId && entry.enabled && entry.isAvailable,
    );
  const fallbackModel = fallbackEntry
    ? resolveAppModelSelectionForInstance(fallbackEntry.instanceId, settings, providers, null)
    : null;
  const selection =
    picked ??
    (usableDefault
      ? defaultSelection
      : fallbackEntry && fallbackModel
        ? createModelSelection(fallbackEntry.instanceId, fallbackModel)
        : null);
  const openThread = (threadId: ThreadId) =>
    navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, threadId)),
    });
  const turnOn = async () => {
    if (!selection || pending) return;
    setPending(true);
    const result = await enable({ environmentId, input: { modelSelection: selection } });
    setPending(false);
    if (result._tag === "Success") await openThread(result.value.threadId);
  };
  const fresh = async () => {
    if (pending) return;
    setPending(true);
    const result = await startFresh({ environmentId, input: {} });
    setPending(false);
    if (result._tag === "Success") await openThread(result.value.threadId);
  };
  const turnOff = async () => {
    if (pending) return;
    setPending(true);
    await disable({ environmentId, input: {} });
    setPending(false);
  };

  const editInstructions = async () => {
    if (!homeWorkspaceRoot) return;
    const separator =
      homeWorkspaceRoot.includes("\\") && !homeWorkspaceRoot.includes("/") ? "\\" : "/";
    const result = await openInEditor(
      `${homeWorkspaceRoot.replace(/[\\/]+$/, "")}${separator}AGENTS.md`,
    );
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not open Home instructions",
        description: error instanceof Error ? error.message : "The editor could not be opened.",
      });
    }
  };

  return settings.home.threadId === null ? (
    <SettingsRow
      {...searchableSetting("home")}
      description="One agent to manage your projects and linked environments, answer questions, and handle approvals."
      control={
        selection ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ProviderModelPicker
              environmentId={environmentId}
              activeInstanceId={selection.instanceId}
              model={selection.model}
              lockedProvider={null}
              instanceEntries={entries}
              modelOptionsByInstance={getCustomModelOptionsByInstance(
                settings,
                providers,
                selection.instanceId,
                selection.model,
              )}
              triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
              disabled={pending || !canEnable}
              onInstanceModelChange={(instanceId, model) =>
                setPicked(createModelSelection(instanceId, model))
              }
            />
            <Button size="sm" disabled={pending || !canEnable} onClick={() => void turnOn()}>
              Turn on Home
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No providers available.</span>
        )
      }
    />
  ) : (
    <>
      <SettingsRow
        {...searchableSetting("home")}
        description="Home keeps its notes and instructions when you start fresh."
        control={
          <Button
            size="sm"
            onClick={() => settings.home.threadId && void openThread(settings.home.threadId)}
          >
            Open Home
          </Button>
        }
      />
      {homeThread ? (
        <SettingsRow
          title="Model"
          control={
            <span className="text-sm text-muted-foreground">{homeThread.modelSelection.model}</span>
          }
        />
      ) : null}
      <SettingsRow
        title="Instructions"
        description="Add your preferences below Home's managed instructions in AGENTS.md."
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canEnable || availableEditors.length === 0}
            onClick={() => void editInstructions()}
          >
            Edit
          </Button>
        }
      />
      <SettingsRow
        title="Start fresh"
        description="Start a new conversation with the same model and notes."
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canStartFresh}
            onClick={() => void fresh()}
          >
            Start fresh
          </Button>
        }
      />
      <SettingsRow
        title="Turn off Home"
        description="Stop Home and its watches. Its conversation stays in history."
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canDisable}
            onClick={() => void turnOff()}
          >
            Turn off Home
          </Button>
        }
      />
    </>
  );
}
