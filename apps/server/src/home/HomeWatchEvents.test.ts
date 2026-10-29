import { expect, it } from "@effect/vitest";
import { ThreadId, type OrchestrationV2StoredEvent } from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as EventStore from "../persistence/OrchestrationEventStore.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
import { liveThreadShell } from "../mcp/McpToolAccess.testkit.ts";
import * as HomeWatchEvents from "./HomeWatchEvents.ts";
import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";

const threadId = ThreadId.make("watched");
const completed = (sequence: number): OrchestrationV2StoredEvent =>
  ({
    sequence,
    commandId: null,
    event: { type: "run.updated", threadId, payload: { status: "completed" } },
  }) as OrchestrationV2StoredEvent;

it.effect(
  "pages bounded milestone history without skipping the remainder of a committed batch",
  () => {
    const stored = Array.from({ length: 205 }, (_, index) => completed(index + 1));
    for (const [index, kind] of [
      "dynamic_tool_call",
      "auth_refresh",
      "user_input",
      "command",
    ].entries())
      stored.push({
        sequence: 206 + index,
        commandId: null,
        event: { type: "runtime-request.updated", threadId, payload: { kind, status: "pending" } },
      } as OrchestrationV2StoredEvent);
    stored.push({
      sequence: 210,
      commandId: null,
      event: { type: "thread.deleted", threadId: ThreadId.make("deleted-watch"), payload: {} },
    } as OrchestrationV2StoredEvent);
    let failLookup = true;
    const layer = HomeWatchEvents.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.mock(EventStore.OrchestrationEventStore)({
            latestApplicationSequence: Effect.succeed(210),
            readAgentEvents: (input) =>
              Stream.fromArray(
                stored.filter(
                  (event) =>
                    event.sequence > (input?.afterSequence ?? 0) &&
                    event.sequence <= (input?.throughSequence ?? Infinity) &&
                    event.event.type === input?.eventType,
                ),
              ),
          }),
          Layer.mock(ThreadManagement.ThreadManagementService)({
            getThreadShell: (id) =>
              failLookup
                ? Effect.fail(
                    new Orchestrator.OrchestratorProjectionError({
                      threadId: id,
                      cause: "Temporary read failure",
                    }),
                  )
                : Effect.succeed(id === threadId ? liveThreadShell(threadId) : null),
          }),
        ),
      ),
    );
    return Effect.gen(function* () {
      const feed = yield* HomeWatchEvents.HomeWatchEvents;
      expect(yield* feed.read({})).toEqual({ sequence: 210, events: [] });
      const failed = yield* feed.read({ afterSequence: 0, timeoutMs: 0 }).pipe(Effect.flip);
      expect(failed._tag).toBe("HomeUnavailableError");
      failLookup = false;
      const first = yield* feed.read({ afterSequence: 0, timeoutMs: 0 });
      const second = yield* feed.read({ afterSequence: first.sequence, timeoutMs: 0 });
      const last = yield* feed.read({ afterSequence: second.sequence, timeoutMs: 0 });
      expect([first.events.length, second.events.length, last.events.length]).toEqual([
        100, 100, 8,
      ]);
      expect([first.sequence, second.sequence, last.sequence]).toEqual([100, 200, 210]);
      expect(last.events.at(-1)).toMatchObject({ threadId: "deleted-watch", kind: "ended" });
      expect(
        new Set([...first.events, ...second.events, ...last.events].map((event) => event.sequence))
          .size,
      ).toBe(208);
    }).pipe(Effect.provide(layer));
  },
);

it.effect("waits for a committed milestone and resumes through its sequence without a timer", () =>
  Effect.gen(function* () {
    const subscribed = yield* Deferred.make<void>();
    const queue = yield* Queue.unbounded<OrchestrationV2StoredEvent>();
    const stored: OrchestrationV2StoredEvent[] = [];
    const layer = HomeWatchEvents.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.mock(EventStore.OrchestrationEventStore)({
            latestApplicationSequence: Effect.sync(() => stored.at(-1)?.sequence ?? 0),
            readAgentEvents: (input) =>
              Stream.fromArray(
                stored.filter(
                  (event) =>
                    event.sequence > (input?.afterSequence ?? 0) &&
                    event.sequence <= (input?.throughSequence ?? Infinity) &&
                    event.event.type === input?.eventType,
                ),
              ),
          }),
          Layer.mock(ThreadManagement.ThreadManagementService)({
            getThreadShell: () => Effect.succeed(liveThreadShell(threadId)),
            streamStoredEventsFrom: () =>
              Stream.unwrap(
                Deferred.succeed(subscribed, undefined).pipe(Effect.as(Stream.fromQueue(queue))),
              ),
          }),
        ),
      ),
    );
    yield* Effect.gen(function* () {
      const feed = yield* HomeWatchEvents.HomeWatchEvents;
      const waiting = yield* feed.read({ afterSequence: 0 }).pipe(Effect.forkChild);
      yield* Deferred.await(subscribed);
      stored.push(completed(1));
      yield* Queue.offer(queue, stored[0]!);
      const result = yield* Fiber.join(waiting);
      expect(result.sequence).toBe(1);
      expect(result.events).toMatchObject([{ threadId, kind: "completed" }]);
    }).pipe(Effect.provide(layer));
  }),
);
