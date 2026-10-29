import {
  type HomeWatchEvent,
  ProviderRequestKind,
  type HomeWatchEventsInput,
  type HomeWatchEventsResult,
  type OrchestrationV2StoredEvent,
  HomeUnavailableError,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as OrchestrationEventStore from "../persistence/OrchestrationEventStore.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";

export class HomeWatchEvents extends Context.Service<
  HomeWatchEvents,
  {
    readonly read: (
      input: HomeWatchEventsInput,
    ) => Effect.Effect<HomeWatchEventsResult, HomeUnavailableError>;
  }
>()("t3/home/HomeWatchEvents") {}

const isApprovalKind = Schema.is(ProviderRequestKind);

function watchEventKind(stored: OrchestrationV2StoredEvent): HomeWatchEvent["kind"] | undefined {
  const event = stored.event;
  switch (event.type) {
    case "run.updated":
      return event.payload.status === "completed"
        ? "completed"
        : event.payload.status === "failed"
          ? "failed"
          : undefined;
    case "runtime-request.updated":
      return event.payload.status !== "pending"
        ? undefined
        : event.payload.kind === "user_input"
          ? "question"
          : isApprovalKind(event.payload.kind)
            ? "approval"
            : undefined;
    case "thread.settled":
    case "thread.archived":
    case "thread.deleted":
      return "ended";
    default:
      return undefined;
  }
}

const make = Effect.gen(function* () {
  const store = yield* OrchestrationEventStore.OrchestrationEventStore;
  const threads = yield* ThreadManagement.ThreadManagementService;
  return HomeWatchEvents.of({
    read: Effect.fn("HomeWatchEvents.read")(function* (input) {
      const latest = yield* store.latestApplicationSequence.pipe(
        Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
      );
      if (input.afterSequence === undefined) return { sequence: latest, events: [] };
      const afterSequence = Math.min(input.afterSequence, latest);
      let through = latest;
      const readHistory = (throughSequence: number) =>
        Effect.forEach(
          [
            "run.updated",
            "runtime-request.updated",
            "thread.settled",
            "thread.archived",
            "thread.deleted",
          ] as const,
          (eventType) =>
            store.readAgentEvents({ afterSequence, throughSequence, eventType }).pipe(
              Stream.filter((stored) => watchEventKind(stored) !== undefined),
              Stream.take(100),
              Stream.runCollect,
            ),
        ).pipe(
          Effect.map((pages) =>
            pages
              .flat()
              .sort((a, b) => a.sequence - b.sequence)
              .slice(0, 100),
          ),
          Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
        );
      let history = yield* readHistory(through);
      if (history.length === 0 && input.timeoutMs !== 0) {
        const first = yield* threads.streamStoredEventsFrom({ afterSequence: through }).pipe(
          Stream.filter((stored) => watchEventKind(stored) !== undefined),
          Stream.runHead,
          Effect.timeoutOption(`${input.timeoutMs ?? 45000} millis`),
          Effect.map(Option.flatten),
          Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
        );
        through = Option.isSome(first)
          ? first.value.sequence
          : yield* store.latestApplicationSequence.pipe(
              Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
            );
        history = yield* readHistory(through);
      }
      const result: HomeWatchEvent[] = [];
      for (const stored of history) {
        const kind = watchEventKind(stored);
        if (kind === undefined) continue;
        const thread = yield* threads
          .getThreadShell(stored.event.threadId)
          .pipe(Effect.orElseSucceed(() => null));
        if (thread === null) continue;
        result.push({ sequence: stored.sequence, threadId: thread.id, title: thread.title, kind });
      }
      return {
        sequence: history.length === 100 ? history.at(-1)!.sequence : through,
        events: result,
      };
    }),
  });
});
export const layer = Layer.effect(HomeWatchEvents, make);
