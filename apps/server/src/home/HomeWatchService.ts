import { type EnvironmentId, HomeWatchEventsResult, type ThreadId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as ServerSettings from "../serverSettings.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as PeerMcpClient from "../peer/PeerMcpClient.ts";
import * as HomeService from "./HomeService.ts";
import * as HomeWatchEvents from "./HomeWatchEvents.ts";

export class HomeWatchService extends Context.Service<
  HomeWatchService,
  {
    readonly start: Effect.Effect<void, never, Scope.Scope>;
  }
>()("t3/home/HomeWatchService") {}

const make = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  const homeService = yield* HomeService.HomeService;
  const events = yield* HomeWatchEvents.HomeWatchEvents;
  const peers = yield* PeerMcpClient.PeerMcpClient;
  const here = yield* ServerEnvironment.ServerEnvironment.pipe(
    Effect.flatMap((environment) => environment.getEnvironmentId),
  );
  const follow = Effect.fn("HomeWatchService.follow")(function* (
    threadId: ThreadId,
    environmentId: EnvironmentId,
  ) {
    const home = yield* homeService.watchState;
    if (home.threadId !== threadId) return false;
    const cursors = home.watches
      .filter((watch) => watch.environmentId === environmentId)
      .map((watch) => watch.sinceSequence);
    const cursor = home.cursors.find((cursor) => cursor.environmentId === environmentId)?.sequence;
    if (home.watchAll && cursor !== undefined) cursors.push(cursor);
    if (cursors.length === 0) return false;
    const afterSequence = cursor === undefined ? undefined : Math.min(...cursors);
    const result =
      environmentId === here
        ? yield* events.read(afterSequence === undefined ? {} : { afterSequence })
        : yield* peers
            .call({
              environmentId,
              tool: "t3_thread_watch_events",
              arguments: afterSequence === undefined ? {} : { afterSequence },
              limits: { runtimeMode: "full-access", interactionMode: "default" },
              success: HomeWatchEventsResult,
            })
            .pipe(
              Effect.mapError((cause) => HomeWatchEvents.watchFeedFailure(environmentId, cause)),
            );
    yield* homeService.report(threadId, environmentId, result);
    return true;
  });
  return HomeWatchService.of({
    start: Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const followers = new Map<string, Fiber.Fiber<void, never>>();
      const settingsChanges = yield* settings.subscribeChanges;
      const watchChanges = yield* homeService.subscribeWatchChanges;
      const changes = Stream.merge(settingsChanges.pipe(Stream.map(() => undefined)), watchChanges);
      const reconcile = Effect.fn("HomeWatchService.reconcile")(function* () {
        const home = yield* homeService.watchState;
        const environmentIds =
          home.threadId === null
            ? []
            : [
                ...new Set([
                  ...home.watches.map((watch) => watch.environmentId),
                  ...(home.watchAll ? home.cursors.map((cursor) => cursor.environmentId) : []),
                ]),
              ];
        const wanted = new Set(environmentIds.map((id) => `${home.threadId}:${id}`));
        if (home.threadId !== null && home.watchAll) wanted.add(`${home.threadId}:discover`);
        for (const [key, fiber] of followers) {
          if (!wanted.has(key)) {
            followers.delete(key);
            yield* Fiber.interrupt(fiber);
          }
        }
        if (home.threadId === null) return;
        const discovery = `${home.threadId}:discover`;
        if (home.watchAll && !followers.has(discovery)) {
          const fiber = yield* homeService.syncWatches.pipe(
            Effect.ignoreCause({ log: true }),
            Effect.repeat(Schedule.spaced("30 seconds")),
            Effect.asVoid,
            Effect.forkIn(scope),
          );
          followers.set(discovery, fiber);
        }
        for (const environmentId of environmentIds) {
          const key = `${home.threadId}:${environmentId}`;
          if (followers.has(key)) continue;
          const fiber = yield* follow(home.threadId, environmentId).pipe(
            Effect.retry(
              Schedule.exponential("5 seconds").pipe(
                Schedule.modifyDelay(({ duration }) =>
                  Effect.succeed(Duration.min(duration, Duration.minutes(5))),
                ),
              ),
            ),
            Effect.repeat({ while: (keepFollowing) => keepFollowing }),
            Effect.asVoid,
            Effect.ignoreCause({ log: true }),
            Effect.forkIn(scope),
          );
          followers.set(key, fiber);
        }
      });
      yield* reconcile().pipe(Effect.ignoreCause({ log: true }));
      yield* changes.pipe(
        Stream.runForEach(() => reconcile().pipe(Effect.ignoreCause({ log: true }))),
        Effect.ignoreCause({ log: true }),
        Effect.forkIn(scope),
      );
    }).pipe(Effect.ignoreCause({ log: true })),
  });
});
export const layer = Layer.effect(HomeWatchService, make);
