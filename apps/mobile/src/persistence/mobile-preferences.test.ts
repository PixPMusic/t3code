import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { vi } from "vite-plus/test";

vi.mock("expo-secure-store", () => ({}));

import * as MobileDatabase from "./mobile-database";
import * as MobilePreferences from "./mobile-preferences";
import * as MobileSecureStorage from "./mobile-secure-storage";

const makeStore = Effect.fn("test.makePreferencesStore")(function* (initial: unknown = {}) {
  const stored = yield* Ref.make(Option.some({ payload: JSON.stringify(initial), updatedAt: 0 }));
  const database = MobileDatabase.MobileDatabase.of({
    loadCache: () => Effect.succeed(Option.none()),
    listCache: () => Effect.succeed([]),
    saveCache: () => Effect.void,
    removeCache: () => Effect.void,
    clearCacheKind: () => Effect.void,
    clearEnvironmentCache: () => Effect.void,
    clearAllCaches: Effect.void,
    inspectCaches: Effect.succeed([]),
    loadPreferencesJson: Ref.get(stored),
    savePreferencesJson: (payload, updatedAt) =>
      Ref.set(stored, Option.some({ payload, updatedAt })),
  });
  const secureStorage = MobileSecureStorage.MobileSecureStorage.of({
    getItem: () => Effect.succeed(null),
    setItem: () => Effect.void,
    removeItem: () => Effect.void,
  });
  return MobilePreferences.make().pipe(
    Effect.provideService(MobileDatabase.MobileDatabase, database),
    Effect.provideService(MobileSecureStorage.MobileSecureStorage, secureStorage),
  );
});

describe("new-thread project preferences", () => {
  it.effect("keeps missing new-thread preferences unset for existing installations", () =>
    Effect.gen(function* () {
      const openStore = yield* makeStore({ workingShelfEnabled: true });
      const store = yield* openStore;
      expect(yield* store.load).toEqual({ workingShelfEnabled: true });
    }),
  );

  it.effect("retains the toggle and scoped last project across store restarts and disabling", () =>
    Effect.gen(function* () {
      const openStore = yield* makeStore();
      const store = yield* openStore;
      const lastThreadProject = { environmentId: "second-machine", projectId: "chosen" };
      yield* store.savePatch({ useLastProjectForNewThreads: true, lastThreadProject });
      const restarted = yield* openStore;
      expect(yield* restarted.load).toEqual({
        useLastProjectForNewThreads: true,
        lastThreadProject,
      });
      yield* restarted.savePatch({ useLastProjectForNewThreads: false });
      expect(yield* (yield* openStore).load).toEqual({
        useLastProjectForNewThreads: false,
        lastThreadProject,
      });
    }),
  );

  it.effect("ignores malformed saved preferences", () =>
    Effect.gen(function* () {
      for (const lastThreadProject of [
        null,
        "chosen",
        { environmentId: "", projectId: "chosen" },
        { projectId: "chosen" },
      ]) {
        const openStore = yield* makeStore({
          useLastProjectForNewThreads: "true",
          lastThreadProject,
        });
        const store = yield* openStore;
        expect(yield* store.load).toEqual({});
      }
    }),
  );
});
