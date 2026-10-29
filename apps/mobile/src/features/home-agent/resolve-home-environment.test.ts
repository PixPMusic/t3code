import { expect, it } from "vite-plus/test";
import { resolveHomeEnvironment } from "./resolve-home-environment";

it("keeps the chosen fleet while it is disabled or reconnecting and resolves its current Home", () => {
  const studio = { environmentId: "studio", threadId: "home:current" };
  const remote = { environmentId: "remote", threadId: "home:remote" };
  expect(resolveHomeEnvironment([studio, remote], "remote")).toBe(remote);
  const fresh = { ...remote, threadId: "home:fresh" };
  expect(resolveHomeEnvironment([studio, fresh], "remote")).toBe(fresh);
  for (const threadId of [null, undefined]) {
    const unavailable = { ...remote, threadId };
    expect(resolveHomeEnvironment([studio, unavailable], "remote")).toBe(unavailable);
  }
  expect(resolveHomeEnvironment([studio], "unlinked")).toBe(studio);
  expect(resolveHomeEnvironment([{ environmentId: "off", threadId: null }, studio])).toBe(studio);
  expect(resolveHomeEnvironment([])).toBeUndefined();
});
