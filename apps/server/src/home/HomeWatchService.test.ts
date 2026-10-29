import { expect, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  OrchestratorMcpFailure,
  ThreadId,
  type HomeWatchEventsInput,
  type HomeWatchEventsResult,
} from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as ServerSettings from "../serverSettings.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PeerMcpClient from "../peer/PeerMcpClient.ts";
import * as HomeService from "./HomeService.ts";
import * as HomeWatchEvents from "./HomeWatchEvents.ts";
import * as HomeWatchService from "./HomeWatchService.ts";

const here = EnvironmentId.make("here");
const remote = EnvironmentId.make("remote");
const homeId = ThreadId.make("home:first");
const workId = ThreadId.make("work");
const snapshot = (environmentId: EnvironmentId): HomeService.HomeWatchSnapshot => ({
  threadId: homeId,
  watchAll: false,
  watches: [{ environmentId, threadId: workId, reason: "requested", sinceSequence: 10 }],
  cursors: [{ environmentId, sequence: 10 }],
});
const settings = Layer.mock(ServerSettings.ServerSettingsService)({
  subscribeChanges: Effect.succeed(Stream.never),
  getSettings: Effect.succeed(DEFAULT_SERVER_SETTINGS),
});
const environment = Layer.mock(ServerEnvironment.ServerEnvironment)({
  getEnvironmentId: Effect.succeed(here),
});

it.effect(
  "reconciles Home identity changes and advances its own cursor without settings events",
  () =>
    Effect.gen(function* () {
      let current = { ...snapshot(here), cursors: [] } as HomeService.HomeWatchSnapshot;
      const changes = yield* PubSub.unbounded<void>();
      const reads = yield* Queue.unbounded<{
        input: HomeWatchEventsInput;
        result: Deferred.Deferred<HomeWatchEventsResult>;
      }>();
      const reports = yield* Queue.unbounded<HomeWatchEventsResult>();
      const cancelled = yield* Queue.unbounded<void>();
      const layer = HomeWatchService.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            settings,
            environment,
            Layer.mock(PeerMcpClient.PeerMcpClient)({}),
            Layer.mock(HomeService.HomeService)({
              watchState: Effect.sync(() => current),
              subscribeWatchChanges: PubSub.subscribe(changes).pipe(
                Effect.map((subscription) => Stream.fromSubscription(subscription)),
              ),
              report: (_threadId, environmentId, batch) =>
                Effect.gen(function* () {
                  current = {
                    ...current,
                    watches: current.watches.map((watch) => ({
                      ...watch,
                      sinceSequence: batch.sequence,
                    })),
                    cursors: [{ environmentId, sequence: batch.sequence }],
                  };
                  yield* Queue.offer(reports, batch);
                }),
            }),
            Layer.mock(HomeWatchEvents.HomeWatchEvents)({
              read: (input) =>
                Effect.gen(function* () {
                  const result = yield* Deferred.make<HomeWatchEventsResult>();
                  yield* Queue.offer(reads, { input, result });
                  return yield* Deferred.await(result);
                }).pipe(Effect.onInterrupt(() => Queue.offer(cancelled, undefined))),
            }),
          ),
        ),
      );
      yield* Effect.gen(function* () {
        yield* (yield* HomeWatchService.HomeWatchService).start;
        const first = yield* Queue.take(reads);
        expect(first.input.afterSequence).toBe(10);
        yield* Deferred.succeed(first.result, { sequence: 20, events: [] });
        yield* Queue.take(reports);
        const following = yield* Queue.take(reads);
        expect(following.input.afterSequence).toBe(20);
        current = { ...current, threadId: ThreadId.make("home:replacement") };
        yield* PubSub.publish(changes, undefined);
        yield* Queue.take(cancelled);
        const replacement = yield* Queue.take(reads);
        expect(replacement.input.afterSequence).toBe(20);
        current = { ...current, threadId: null };
        yield* PubSub.publish(changes, undefined);
        yield* Queue.take(cancelled);
      }).pipe(Effect.provide(layer));
    }),
);

it.effect("backs off unreachable peer reads exponentially and caps retries at five minutes", () =>
  Effect.gen(function* () {
    const attempts = yield* Queue.unbounded<void>();
    const layer = HomeWatchService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          settings,
          environment,
          Layer.mock(HomeService.HomeService)({
            watchState: Effect.succeed(snapshot(remote)),
            subscribeWatchChanges: Effect.succeed(Stream.never),
          }),
          Layer.mock(HomeWatchEvents.HomeWatchEvents)({}),
          Layer.mock(PeerMcpClient.PeerMcpClient)({
            call: () =>
              Queue.offer(attempts, undefined).pipe(
                Effect.andThen(
                  Effect.fail(
                    new OrchestratorMcpFailure({ code: "orchestration_error", message: "Offline" }),
                  ),
                ),
              ),
          }),
        ),
      ),
    );
    yield* Effect.gen(function* () {
      yield* (yield* HomeWatchService.HomeWatchService).start;
      yield* Queue.take(attempts);
      for (const seconds of [5, 10, 20, 40, 80, 160, 300, 300]) {
        yield* TestClock.adjust(`${seconds - 1} seconds`);
        expect(yield* Queue.size(attempts)).toBe(0);
        yield* TestClock.adjust("1 second");
        yield* Queue.take(attempts);
      }
    }).pipe(Effect.provide(layer));
  }),
);
