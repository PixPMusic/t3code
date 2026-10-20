import type { ClientSettings } from "@t3tools/contracts";
import { useState } from "react";

export function useResumeCompactionSelection(
  preference: ClientSettings["automaticCompactionSuggestions"],
  threadKey: string,
) {
  const [selection, setSelection] = useState(() => ({
    preference,
    overrides: new Map<string, boolean>(),
  }));
  if (selection.preference !== preference) {
    setSelection({ preference, overrides: new Map() });
  }

  const defaultKeepFullHistory = preference !== "on";
  const keepFullHistory =
    selection.preference === preference
      ? (selection.overrides.get(threadKey) ?? defaultKeepFullHistory)
      : defaultKeepFullHistory;
  const setKeepFullHistory = (key: string, keep: boolean) => {
    setSelection((current) => {
      // A send can finish after the preference changes; leave the new selection alone.
      if (current.preference !== preference) return current;
      if ((current.overrides.get(key) ?? defaultKeepFullHistory) === keep) return current;
      const overrides = new Map(current.overrides);
      if (keep === defaultKeepFullHistory) overrides.delete(key);
      else overrides.set(key, keep);
      return { preference, overrides };
    });
  };

  return { keepFullHistory, setKeepFullHistory, defaultKeepFullHistory };
}
