import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ServerConfig from "../config.ts";
import * as HomeWatchState from "./HomeWatchState.ts";

const state: HomeWatchState.WatchState = {
  cursors: [{ environmentId: EnvironmentId.make("remote"), sequence: 40 }],
  watches: [
    {
      environmentId: EnvironmentId.make("remote"),
      threadId: ThreadId.make("watched"),
      sinceSequence: 30,
    },
  ],
};

it.effect(
  "durably stores progress separately and fails closed on malformed state until explicitly repaired",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-home-watch-state-" });
      yield* Effect.gen(function* () {
        const config = yield* ServerConfig.ServerConfig;
        const read = HomeWatchState.HomeWatchState.pipe(Effect.flatMap((store) => store.read));
        yield* HomeWatchState.HomeWatchState.pipe(
          Effect.flatMap((store) => store.write(state)),
          Effect.provide(Layer.fresh(HomeWatchState.layer)),
        );
        expect(yield* read.pipe(Effect.provide(Layer.fresh(HomeWatchState.layer)))).toEqual(state);
        const statePath = path.join(config.stateDir, "home-watch.json");
        yield* fs.writeFileString(statePath, "not-json");
        yield* Effect.gen(function* () {
          const store = yield* HomeWatchState.HomeWatchState;
          expect((yield* store.read.pipe(Effect.flip)).operation).toBe("read");
          yield* store.write(HomeWatchState.EMPTY_WATCH_STATE);
          expect(yield* store.read).toEqual(HomeWatchState.EMPTY_WATCH_STATE);
        }).pipe(Effect.provide(Layer.fresh(HomeWatchState.layer)));
        expect(yield* read.pipe(Effect.provide(Layer.fresh(HomeWatchState.layer)))).toEqual(
          HomeWatchState.EMPTY_WATCH_STATE,
        );
      }).pipe(Effect.provide(ServerConfig.layerTest(baseDir, baseDir)));
    }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("imports existing progress once before summary-only settings can replace it", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-home-watch-import-" });
    yield* Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      yield* fs.makeDirectory(config.stateDir, { recursive: true });
      yield* fs.writeFileString(
        config.settingsPath,
        JSON.stringify({ home: { threadId: "home:current", ...state } }),
      );
      const read = HomeWatchState.HomeWatchState.pipe(Effect.flatMap((store) => store.read));
      expect(yield* read.pipe(Effect.provide(Layer.fresh(HomeWatchState.layer)))).toEqual(state);
      yield* fs.writeFileString(
        config.settingsPath,
        JSON.stringify({ home: { threadId: "home:current", watchAll: true, watches: [] } }),
      );
      expect(yield* read.pipe(Effect.provide(Layer.fresh(HomeWatchState.layer)))).toEqual(state);
    }).pipe(Effect.provide(ServerConfig.layerTest(baseDir, baseDir)));
  }).pipe(Effect.provide(NodeServices.layer)),
);
