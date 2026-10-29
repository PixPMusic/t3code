import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as HomeService from "../../../home/HomeService.ts";
import * as HomeWatchEvents from "../../../home/HomeWatchEvents.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { readCaller, unavailable } from "../../threadAccess.ts";
import { HomeToolkit } from "./tools.ts";

export const layer = McpToolAccess.toLayer(
  HomeToolkit,
  Effect.gen(function* () {
    const maybeHome = yield* Effect.serviceOption(HomeService.HomeService);
    const maybeEvents = yield* Effect.serviceOption(HomeWatchEvents.HomeWatchEvents);
    return {
      t3_thread_watch: McpToolAccess.actsAsCaller((input) =>
        Effect.gen(function* () {
          const { scope } = yield* readCaller();
          if (Option.isNone(maybeHome)) return yield* unavailable();
          const home = maybeHome.value;
          if (scope.thread === undefined || !(yield* home.isHome(scope.thread.threadId)))
            return yield* new OrchestratorMcpFailure({
              code: "capability_denied",
              message: "Only the current Home can change its watches.",
            });
          return yield* home.watch(scope.thread.threadId, input).pipe(Effect.mapError(unavailable));
        }),
      ),
      t3_thread_watch_events: McpToolAccess.reads((input) =>
        Effect.gen(function* () {
          yield* readCaller();
          if (Option.isNone(maybeEvents)) return yield* unavailable();
          return yield* maybeEvents.value.read(input).pipe(Effect.mapError(unavailable));
        }),
      ),
    };
  }),
);
