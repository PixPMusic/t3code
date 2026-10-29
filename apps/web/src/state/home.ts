import { useAtomValue } from "@effect/atom-react";
import { createHomeEnvironmentAtoms } from "@t3tools/client-runtime/state/home";
import { Atom } from "effect/reactivity";

import { connectionAtomRuntime } from "../connection/runtime";
import { environmentPresentations } from "./presentation";
import { primaryEnvironmentIdAtom } from "./primaryEnvironment";

export const homeEnvironment = createHomeEnvironmentAtoms(connectionAtomRuntime);

export const homesAtom = Atom.withEquality(
  Atom.make((get) => {
    const primaryEnvironmentId = get(primaryEnvironmentIdAtom);
    return [...get(environmentPresentations.presentationsAtom)]
      .flatMap(([environmentId, environment]) => {
        const threadId = environment.serverConfig?.settings.home.threadId;
        return threadId ? [{ environmentId, label: environment.entry.target.label, threadId }] : [];
      })
      .toSorted((left, right) =>
        left.environmentId === primaryEnvironmentId
          ? -1
          : right.environmentId === primaryEnvironmentId
            ? 1
            : left.label.localeCompare(right.label),
      );
  }),
  (previous, next) =>
    previous.length === next.length &&
    previous.every(
      (entry, index) =>
        entry.environmentId === next[index]?.environmentId &&
        entry.threadId === next[index]?.threadId &&
        entry.label === next[index]?.label,
    ),
).pipe(Atom.withLabel("web-homes"));

export function useHomes() {
  return useAtomValue(homesAtom);
}
