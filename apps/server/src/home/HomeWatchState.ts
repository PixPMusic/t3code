import { EnvironmentId, HomeUnavailableError, NonNegativeInt, ThreadId } from "@t3tools/contracts";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Result from "effect/Result";
import * as ServerConfig from "../config.ts";

const WatchCursor = Schema.Struct({ environmentId: EnvironmentId, sequence: NonNegativeInt });
const WatchProgress = Schema.Struct({
  environmentId: EnvironmentId,
  threadId: ThreadId,
  sinceSequence: NonNegativeInt,
});
export const WatchState = Schema.Struct({
  cursors: Schema.Array(WatchCursor),
  watches: Schema.Array(WatchProgress),
});
export type WatchState = typeof WatchState.Type;
export const EMPTY_WATCH_STATE: WatchState = { cursors: [], watches: [] };
const codec = Schema.fromJsonString(WatchState);
const legacyCodec = Schema.fromJsonString(Schema.Struct({ home: WatchState }));

export class HomeWatchState extends Context.Service<
  HomeWatchState,
  {
    readonly read: Effect.Effect<WatchState, HomeUnavailableError>;
    readonly write: (state: WatchState) => Effect.Effect<void, HomeUnavailableError>;
  }
>()("t3/home/HomeWatchState") {}

export const layer = Layer.effect(
  HomeWatchState,
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const statePath = path.join(config.stateDir, "home-watch.json");
    const readFile = (file: string) =>
      fs.readFileString(file).pipe(
        Effect.catchIf(
          (error) => error.reason._tag === "NotFound",
          () => Effect.succeed(null),
        ),
        Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
      );
    let imported = false;
    const load = Effect.gen(function* () {
      const stored = yield* readFile(statePath);
      if (stored !== null)
        return yield* Schema.decodeEffect(codec)(stored).pipe(
          Effect.mapError((cause) => new HomeUnavailableError({ operation: "read", cause })),
        );
      const legacy = yield* readFile(config.settingsPath);
      return legacy === null
        ? EMPTY_WATCH_STATE
        : yield* Schema.decodeEffect(legacyCodec)(legacy).pipe(
            Effect.map((value) => {
              imported = true;
              return value.home;
            }),
            Effect.orElseSucceed(() => EMPTY_WATCH_STATE),
          );
    });
    let current = yield* Effect.result(load);
    const write = Effect.fn("HomeWatchState.write")(
      function* (state: WatchState) {
        const encoded = yield* Schema.encodeEffect(codec)(state);
        yield* writeFileStringAtomically({ filePath: statePath, contents: encoded }).pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path),
        );
        current = Result.succeed(state);
      },
      Effect.mapError((cause) => new HomeUnavailableError({ operation: "save", cause })),
    );
    if (imported && Result.isSuccess(current)) {
      const saved = yield* Effect.result(write(current.success));
      if (Result.isFailure(saved)) current = Result.fail(saved.failure);
    }
    return HomeWatchState.of({
      read: Effect.suspend(() =>
        Result.isSuccess(current) ? Effect.succeed(current.success) : Effect.fail(current.failure),
      ),
      write,
    });
  }),
);

export const layerMemory = Layer.sync(HomeWatchState, () => {
  let current = EMPTY_WATCH_STATE;
  return HomeWatchState.of({
    read: Effect.sync(() => current),
    write: Effect.fn("HomeWatchState.write")((state) =>
      Effect.sync(() => {
        current = state;
      }),
    ),
  });
});
