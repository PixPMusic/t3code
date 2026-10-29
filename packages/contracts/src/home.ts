import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { EnvironmentId, NonNegativeInt, ThreadId } from "./baseSchemas.ts";
import { ModelSelection } from "./modelSelection.ts";

export const HOME_THREAD_ID_PREFIX = "home:";
export const HOME_REPORT_MESSAGE_ID_PREFIX = "home-report:";
export const isHomeThreadId = (id: string) => id.startsWith(HOME_THREAD_ID_PREFIX);
export const isHomeReportMessageId = (id: string) => id.startsWith(HOME_REPORT_MESSAGE_ID_PREFIX);

export const HomeWatch = Schema.Struct({
  environmentId: EnvironmentId,
  threadId: ThreadId,
  reason: Schema.Literals(["launched", "requested"]),
  sinceSequence: NonNegativeInt.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
});
export type HomeWatch = typeof HomeWatch.Type;
export const HomeWatchCursor = Schema.Struct({
  environmentId: EnvironmentId,
  sequence: NonNegativeInt,
});
export const HomeSettings = Schema.Struct({
  threadId: Schema.NullOr(ThreadId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  watchAll: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  watches: Schema.Array(HomeWatch).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  cursors: Schema.Array(HomeWatchCursor).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
});
export type HomeSettings = typeof HomeSettings.Type;
export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  threadId: null,
  watchAll: false,
  watches: [],
  cursors: [],
};
export const HomeEnableInput = Schema.Struct({ modelSelection: ModelSelection });
export type HomeEnableInput = typeof HomeEnableInput.Type;
export const HomeThreadResult = Schema.Struct({ threadId: ThreadId });
export type HomeThreadResult = typeof HomeThreadResult.Type;
export class HomeUnavailableError extends Schema.TaggedError<HomeUnavailableError>()(
  "HomeUnavailableError",
  {
    operation: Schema.Literals(["read", "save", "launch", "stop", "off"]),
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message() {
    return this.operation === "off"
      ? "Turn Home on first."
      : "Home could not complete the operation.";
  }
}
export const HomeWatchEvent = Schema.Struct({
  sequence: NonNegativeInt,
  threadId: ThreadId,
  title: Schema.String,
  kind: Schema.Literals(["completed", "failed", "question", "approval", "ended"]),
});
export type HomeWatchEvent = typeof HomeWatchEvent.Type;
export const HomeWatchEventsInput = Schema.Struct({
  afterSequence: Schema.optional(NonNegativeInt),
  timeoutMs: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 45000 }))),
});
export type HomeWatchEventsInput = typeof HomeWatchEventsInput.Type;
export const HomeWatchEventsResult = Schema.Struct({
  sequence: NonNegativeInt,
  events: Schema.Array(HomeWatchEvent),
});
export type HomeWatchEventsResult = typeof HomeWatchEventsResult.Type;
export const HomeWatchInput = Schema.Struct({
  action: Schema.Literals(["watch", "unwatch", "watch_all", "unwatch_all"]),
  environmentId: Schema.optional(EnvironmentId),
  threadId: Schema.optional(ThreadId),
});
export type HomeWatchInput = typeof HomeWatchInput.Type;
