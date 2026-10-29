import { type HomeSettings, type ScopedThreadRef, WS_METHODS } from "@t3tools/contracts";
import type { Atom } from "effect/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createAtomCommandScheduler, createEnvironmentRpcCommand } from "./runtime.ts";

export function createHomeEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const scheduler = createAtomCommandScheduler();
  const concurrency = {
    mode: "serial" as const,
    key: ({ environmentId }: { environmentId: string }) => environmentId,
  };
  return {
    enable: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:home:enable",
      tag: WS_METHODS.homeEnable,
      scheduler,
      concurrency,
    }),
    disable: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:home:disable",
      tag: WS_METHODS.homeDisable,
      scheduler,
      concurrency,
    }),
    startFresh: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:home:start-fresh",
      tag: WS_METHODS.homeStartFresh,
      scheduler,
      concurrency,
    }),
  };
}

export function isHomeWatchedLaunch(home: HomeSettings, target: ScopedThreadRef): boolean {
  return (
    home.threadId !== null &&
    home.watches.some(
      (watch) =>
        watch.reason === "launched" &&
        watch.environmentId === target.environmentId &&
        watch.threadId === target.threadId,
    )
  );
}
