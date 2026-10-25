import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  newTaskDestination,
  resolveDraftProjectSelection,
  resolveEnvironmentProjectMatch,
} from "./new-task-project-selection";

function makeProject(
  id: string,
  environmentId = "environment",
  options: {
    readonly title?: string;
    readonly workspaceRoot?: string;
    readonly repositoryKey?: string;
  } = {},
): EnvironmentProject {
  return {
    environmentId: EnvironmentId.make(environmentId),
    id: ProjectId.make(id),
    title: options.title ?? id,
    workspaceRoot: options.workspaceRoot ?? `/work/${id}`,
    repositoryIdentity: options.repositoryKey
      ? {
          canonicalKey: options.repositoryKey,
          locator: {
            source: "git-remote",
            remoteName: "origin",
            remoteUrl: `https://${options.repositoryKey}.git`,
          },
        }
      : null,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("resolveEnvironmentProjectMatch", () => {
  it("follows the same repository onto the target machine", () => {
    const selected = makeProject("t3code", "mac", { repositoryKey: "github.com/t3tools/t3code" });
    const target = [
      makeProject("other", "server", { repositoryKey: "github.com/t3tools/other" }),
      makeProject("t3code-clone", "server", { repositoryKey: "github.com/t3tools/t3code" }),
    ];
    expect(resolveEnvironmentProjectMatch(target, selected)).toBe(target[1]);
  });

  it("falls back to workspace basename, then title, for unindexed projects", () => {
    const selected = makeProject("t3code", "mac", { workspaceRoot: "/Users/me/t3code" });
    const byBasename = [
      makeProject("other", "server"),
      makeProject("srv", "server", { workspaceRoot: "/home/me/t3code" }),
    ];
    expect(resolveEnvironmentProjectMatch(byBasename, selected)).toBe(byBasename[1]);

    const byTitle = [
      makeProject("other", "server"),
      makeProject("srv", "server", { title: "t3code" }),
    ];
    expect(resolveEnvironmentProjectMatch(byTitle, selected)).toBe(byTitle[1]);
  });

  it("does not treat a known different repository as a basename or title match", () => {
    const selected = makeProject("t3code", "mac", {
      repositoryKey: "github.com/t3tools/t3code",
      workspaceRoot: "/Users/me/t3code",
    });
    const fork = makeProject("fork", "server", {
      repositoryKey: "github.com/someone/t3code",
      title: "t3code",
      workspaceRoot: "/home/me/t3code",
    });
    const unindexed = makeProject("unindexed", "server", { workspaceRoot: "/srv/t3code" });
    expect(resolveEnvironmentProjectMatch([fork, unindexed], selected)).toBe(unindexed);
    expect(resolveEnvironmentProjectMatch([fork], selected)).toBe(fork);
  });
});

describe("resolveDraftProjectSelection", () => {
  it("keeps the picker even when only one project is available", () => {
    expect(resolveDraftProjectSelection(null, [makeProject("only")])).toEqual({ kind: "pick" });
  });

  it("preserves an explicit project selection", () => {
    expect(resolveDraftProjectSelection("environment:chosen", [makeProject("chosen")])).toEqual({
      kind: "preserve",
    });
  });

  it("returns to the picker when the selected project is missing", () => {
    expect(resolveDraftProjectSelection("environment:removed", [makeProject("only")])).toEqual({
      kind: "pick",
    });
  });
});

describe("newTaskDestination", () => {
  const request = { draft: { requestId: "request" } };

  it.each([undefined, false])("opens the picker when the preference is %s", (useLastProject) => {
    const projects = [makeProject("first"), makeProject("current", "other-environment")];
    expect(
      newTaskDestination(useLastProject, projects, projects[1], "request", {
        environmentId: "environment",
        projectId: "first",
      }),
    ).toEqual(request);
  });

  it("uses the current thread or draft project when enabled", () => {
    const projects = [makeProject("first"), makeProject("current", "other-environment")];
    expect(
      newTaskDestination(true, projects, projects[1], "request", {
        environmentId: "environment",
        projectId: "first",
      }),
    ).toEqual({
      draft: { requestId: "request", environmentId: "other-environment", projectId: "current" },
    });
  });

  it("remembers the last project from Home without relying on project order", () => {
    const projects = [makeProject("same-id"), makeProject("same-id", "other-environment")];
    expect(
      newTaskDestination(true, projects, undefined, "request", {
        environmentId: "other-environment",
        projectId: "same-id",
      }),
    ).toEqual({
      draft: { requestId: "request", environmentId: "other-environment", projectId: "same-id" },
    });
  });

  it("uses the remembered project when the current project is stale", () => {
    const project = makeProject("remembered");
    expect(
      newTaskDestination(true, [project], makeProject("removed"), "request", {
        environmentId: "environment",
        projectId: "remembered",
      }),
    ).toEqual({
      draft: { requestId: "request", environmentId: "environment", projectId: "remembered" },
    });
  });

  it.each([
    undefined,
    { environmentId: "removed-environment", projectId: "first" },
    { environmentId: "environment", projectId: "removed" },
  ])("keeps the picker when the last project is missing or stale: %s", (lastProject) => {
    const projects = [makeProject("first"), makeProject("second")];
    expect(
      newTaskDestination(true, projects, makeProject("removed"), "request", lastProject),
    ).toEqual(request);
  });

  it("keeps the picker when no projects are available", () => {
    expect(
      newTaskDestination(true, [], undefined, "request", {
        environmentId: "environment",
        projectId: "removed",
      }),
    ).toEqual(request);
  });
});
