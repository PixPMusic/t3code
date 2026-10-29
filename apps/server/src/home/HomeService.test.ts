import { expect, it } from "@effect/vitest";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import {
  EnvironmentId,
  ProjectId,
  OrchestratorMcpFailure,
  type PeerLinkSummary,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationV2ThreadShell,
  type OrchestrationV2ServerCommand,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ServerSettings from "../serverSettings.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as ThreadLaunch from "../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
import * as ManagedProjectFolders from "../project/ManagedProjectFolders.ts";
import * as PeerLinks from "../peer/PeerLinks.ts";
import * as PeerMcpClient from "../peer/PeerMcpClient.ts";
import * as HomeWatchEvents from "./HomeWatchEvents.ts";
import * as HomeService from "./HomeService.ts";

const here = EnvironmentId.make("home-host");
const projectId = ProjectId.make("home-project");
const modelSelection = { instanceId: ProviderInstanceId.make("codex"), model: "test-model" };
function setup() {
  const launches: ThreadLaunch.ThreadLaunchInput[] = [];
  const linked: PeerLinkSummary[] = [];
  const remoteSequences = new Map<EnvironmentId, number>();
  const sequence = { value: 10 };
  const sends: ThreadManagement.ThreadManagementSendInput[] = [];
  const stops: OrchestrationV2ServerCommand[] = [];
  const grantAtStop: Array<ThreadId | null> = [];
  const layers = Layer.mergeAll(
    NodeCrypto.layer,
    ServerSettings.layerTest(),
    Layer.mock(ServerEnvironment.ServerEnvironment)({ getEnvironmentId: Effect.succeed(here) }),
    Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
      homeRoot: "/home",
      namedProjectsRoot: "/projects",
      ensureHomeProject: Effect.succeed({ projectId, workspaceRoot: "/home" }),
    }),
    Layer.mock(ThreadLaunch.ThreadLaunchService)({
      launch: (input) => {
        launches.push(input);
        return Effect.succeed({ threadId: input.threadId! } as ThreadLaunch.ThreadLaunchResult);
      },
    }),
    Layer.mock(ThreadManagement.ThreadManagementService)({
      getThreadShell: (id) =>
        Effect.succeed({
          id,
          projectId,
          modelSelection,
          deletedAt: null,
          archivedAt: null,
        } as OrchestrationV2ThreadShell),
      sendToThread: (input) => {
        sends.push(input);
        return Effect.succeed({} as ThreadManagement.ThreadManagementSendResult);
      },
      dispatch: (command) =>
        Effect.gen(function* () {
          stops.push(command);
          const settings = Option.getOrThrow(
            yield* Effect.serviceOption(ServerSettings.ServerSettingsService),
          );
          grantAtStop.push((yield* settings.getSettings.pipe(Effect.orDie)).home.threadId);
          return {} as never;
        }),
    }),
    Layer.mock(PeerLinks.PeerLinks)({ list: Effect.succeed(linked) }),
    Layer.mock(PeerMcpClient.PeerMcpClient)({
      call: (input) =>
        remoteSequences.has(input.environmentId)
          ? Effect.succeed({
              sequence: remoteSequences.get(input.environmentId)!,
              events: [],
            } as never)
          : Effect.fail(
              new OrchestratorMcpFailure({ code: "orchestration_error", message: "Offline" }),
            ),
    }),
    Layer.mock(HomeWatchEvents.HomeWatchEvents)({
      read: () => Effect.succeed({ sequence: sequence.value, events: [] }),
    }),
  );
  return {
    launches,
    linked,
    remoteSequences,
    sequence,
    sends,
    stops,
    grantAtStop,
    layer: HomeService.layer.pipe(Layer.provideMerge(layers)),
  };
}

it.effect(
  "enables one Home, resets its model and revokes the previous identity before stopping it",
  () => {
    const test = setup();
    return Effect.gen(function* () {
      const home = yield* HomeService.HomeService;
      const first = yield* home.enable({ modelSelection });
      expect((yield* home.enable({ modelSelection })).threadId).toBe(first.threadId);
      expect(test.launches).toHaveLength(1);
      expect(test.launches[0]).toMatchObject({
        runtimeMode: "full-access",
        interactionMode: "default",
        projectId,
      });
      const next = yield* home.startFresh;
      expect(next.threadId).not.toBe(first.threadId);
      expect(test.launches[1]?.modelSelection).toEqual(modelSelection);
      expect(yield* home.isHome(first.threadId)).toBe(false);
      expect(test.grantAtStop[0]).toBe(next.threadId);
      expect(test.stops[0]?.type).toBe("thread.stop");
      yield* home.disable;
      expect(yield* home.isHome(next.threadId)).toBe(false);
      expect(test.grantAtStop.at(-1)).toBeNull();
      expect((yield* Effect.exit(home.watch(first.threadId, { action: "watch_all" })))._tag).toBe(
        "Failure",
      );
    }).pipe(Effect.provide(test.layer));
  },
);

it.effect(
  "replays a launch's milestones even when a fleet cursor advanced before its watch was registered",
  () => {
    const test = setup();
    return Effect.gen(function* () {
      const home = yield* HomeService.HomeService;
      const settings = yield* ServerSettings.ServerSettingsService;
      const { threadId } = yield* home.enable({ modelSelection });
      const sinceSequence = yield* home.prepareLaunch(threadId);
      yield* home.watch(threadId, { action: "watch_all" });
      yield* home.report(threadId, here, { sequence: 30, events: [] });
      const launchedId = ThreadId.make("new-work");
      yield* home.watchLaunch(threadId, { threadId: launchedId, sinceSequence });
      const event = {
        sequence: 20,
        threadId: launchedId,
        title: "Demo work",
        kind: "completed" as const,
      };
      yield* home.report(threadId, here, { sequence: 30, events: [event] });
      yield* home.report(threadId, here, { sequence: 30, events: [event] });
      expect(test.sends).toHaveLength(1);
      expect(test.sends[0]?.text).toContain("Demo work");
      expect(test.sends[0]?.text).toContain("t3-thread://");
      expect((yield* settings.getSettings).home.watches[0]?.sinceSequence).toBe(30);
      const replacement = yield* home.startFresh;
      yield* home.report(threadId, here, { sequence: 40, events: [{ ...event, sequence: 40 }] });
      expect(test.sends).toHaveLength(1);
      expect(yield* home.isHome(replacement.threadId)).toBe(true);
    }).pipe(Effect.provide(test.layer));
  },
);

it.effect("drops ended watches after delivering pending questions and approvals", () => {
  const test = setup();
  return Effect.gen(function* () {
    const home = yield* HomeService.HomeService;
    const settings = yield* ServerSettings.ServerSettingsService;
    const { threadId } = yield* home.enable({ modelSelection });
    const work = ThreadId.make("watched-work");
    yield* home.watch(threadId, { action: "watch", threadId: work });
    yield* home.report(threadId, here, {
      sequence: 15,
      events: [
        { sequence: 11, threadId: work, title: "Work", kind: "question" },
        { sequence: 12, threadId: work, title: "Work", kind: "approval" },
        { sequence: 13, threadId: work, title: "Work", kind: "failed" },
        { sequence: 14, threadId: work, title: "Work", kind: "ended" },
        { sequence: 15, threadId: ThreadId.make("unwatched"), title: "Other", kind: "completed" },
      ],
    });
    expect(test.sends).toHaveLength(3);
    expect((yield* settings.getSettings).home.watches).toEqual([]);
  }).pipe(Effect.provide(test.layer));
});

it.effect(
  "watch_all tolerates offline peers, discovers recovered links and starts a new baseline after turning off",
  () => {
    const test = setup();
    const remote = EnvironmentId.make("linked-host");
    return Effect.gen(function* () {
      const home = yield* HomeService.HomeService;
      const settings = yield* ServerSettings.ServerSettingsService;
      const { threadId } = yield* home.enable({ modelSelection });
      test.linked.push({ environmentId: remote } as PeerLinkSummary);
      yield* home.watch(threadId, { action: "watch_all" });
      expect(
        (yield* settings.getSettings).home.cursors.map((cursor) => cursor.environmentId),
      ).toEqual([here]);
      test.remoteSequences.set(remote, 40);
      yield* home.syncWatches;
      expect((yield* settings.getSettings).home.cursors).toContainEqual({
        environmentId: remote,
        sequence: 40,
      });
      yield* home.report(threadId, remote, {
        sequence: 41,
        events: [
          {
            sequence: 41,
            threadId: ThreadId.make("home:other-host"),
            title: "Other Home",
            kind: "completed",
          },
        ],
      });
      expect(test.sends).toEqual([]);
      yield* home.watch(threadId, { action: "unwatch_all" });
      test.sequence.value = 100;
      test.remoteSequences.set(remote, 200);
      yield* home.watch(threadId, { action: "watch_all" });
      expect((yield* settings.getSettings).home.cursors).toEqual([
        { environmentId: here, sequence: 100 },
        { environmentId: remote, sequence: 200 },
      ]);
      test.sequence.value = 101;
      yield* home.watch(threadId, { action: "watch_all" });
      expect((yield* settings.getSettings).home.cursors[0]?.sequence).toBe(100);
    }).pipe(Effect.provide(test.layer));
  },
);
