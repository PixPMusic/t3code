import {
  CommandId,
  EnvironmentId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { HomeProjectScope } from "../home/homeThreadList";
import { buildHomeProjectScopes } from "../home/homeThreadList";
import {
  decodeQueuedThreadMessage,
  encodeQueuedThreadMessage,
  type QueuedThreadMessage,
} from "../../state/thread-outbox-model";
import {
  filterProjectScopes,
  getProjectScopeSelectionTarget,
  resolveDraftProjectSelection,
  resolveEnvironmentProjectMatch,
  resolvePendingTaskProject,
} from "./new-task-project-selection";

function makeProject(
  id: string,
  environmentId = "environment",
  options: {
    readonly title?: string;
    readonly workspaceRoot?: string;
    readonly repositoryKey?: string;
    readonly isScratch?: true;
  } = {},
): EnvironmentProject {
  return {
    environmentId: EnvironmentId.make(environmentId),
    id: ProjectId.make(id),
    title: options.title ?? id,
    workspaceRoot: options.workspaceRoot ?? `/work/${id}`,
    ...(options.isScratch ? { isScratch: true as const } : {}),
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

function makeScope(projects: ReadonlyArray<EnvironmentProject>): HomeProjectScope {
  return {
    key: "github.com/t3tools/t3code",
    title: "T3 Code",
    representative: projects[0]!,
    projects,
    projectRefs: projects.map((project) => ({
      environmentId: project.environmentId,
      projectId: project.id,
    })),
  };
}

const queuedTask: QueuedThreadMessage = {
  environmentId: EnvironmentId.make("mac"),
  threadId: ThreadId.make("queued-thread"),
  messageId: MessageId.make("queued-message"),
  commandId: CommandId.make("queued-command"),
  text: "Help me plan the task",
  attachments: [],
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.6-sol" },
  creation: {
    projectId: ProjectId.make("scratch-mac"),
    projectTitle: "No project",
    projectCwd: "/Users/alex/.t3/scratch/",
    workspaceMode: "local",
    branch: null,
    worktreePath: null,
  },
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("resolvePendingTaskProject", () => {
  const scratchRoot = "/Users/alex/.t3/scratch";
  const remoteScratch = makeProject("scratch-server", "server", {
    isScratch: true,
    title: "Tasks",
    workspaceRoot: "/var/lib/t3/tasks",
  });
  const ordinary = makeProject("ordinary", "server", {
    title: "No project",
    workspaceRoot: "/work/scratch",
  });

  it("keeps a queued scratch task on its counterpart before the original shell loads", () => {
    const restored = decodeQueuedThreadMessage(encodeQueuedThreadMessage(queuedTask));
    const pending = resolvePendingTaskProject(restored, scratchRoot);

    expect(resolveEnvironmentProjectMatch([ordinary, remoteScratch], pending)).toBe(remoteScratch);
    expect(resolveEnvironmentProjectMatch([ordinary], pending)).toBeNull();
    expect(pending?.defaultModelSelection).toEqual(queuedTask.modelSelection);
    expect(pending?.environmentId).toBe(queuedTask.environmentId);
  });

  it.each([
    { cwd: undefined, root: scratchRoot },
    { cwd: "", root: scratchRoot },
    { cwd: "/work/scratch", root: scratchRoot },
    { cwd: queuedTask.creation!.projectCwd, root: undefined },
    { cwd: queuedTask.creation!.projectCwd, root: "/other-host/scratch" },
  ])("requires a known cwd matching the queued host's advertised root (%j)", ({ cwd, root }) => {
    const pending = resolvePendingTaskProject(
      { ...queuedTask, creation: { ...queuedTask.creation!, projectCwd: cwd } },
      root,
    );

    expect(resolveEnvironmentProjectMatch([remoteScratch, ordinary], pending)).toBe(ordinary);
    expect(pending?.isScratch).toBeUndefined();
  });
});

describe("getProjectScopeSelectionTarget", () => {
  it("keeps the current environment when it hosts the selected logical project", () => {
    const projects = [makeProject("t3code-mac", "mac"), makeProject("t3code-server", "server")];
    expect(getProjectScopeSelectionTarget(makeScope(projects), EnvironmentId.make("server"))).toBe(
      projects[1],
    );
  });

  it("falls back to the representative when the current environment does not host the project", () => {
    const projects = [makeProject("t3code-mac", "mac"), makeProject("t3code-server", "server")];
    expect(getProjectScopeSelectionTarget(makeScope(projects), EnvironmentId.make("other"))).toBe(
      projects[0],
    );
  });
});

describe("resolveEnvironmentProjectMatch", () => {
  it("matches only scratch counterparts regardless of their path or title", () => {
    const selected = makeProject("scratch-a", "mac", {
      isScratch: true,
      title: "No project",
      workspaceRoot: "/Users/alex/.t3/scratch",
    });
    const misleading = makeProject("ordinary", "server", {
      title: "No project",
      workspaceRoot: "/work/scratch",
    });
    const counterpart = makeProject("scratch-b", "server", {
      isScratch: true,
      title: "Scratch",
      workspaceRoot: "/var/lib/t3/tasks",
    });
    expect(resolveEnvironmentProjectMatch([misleading, counterpart], selected)).toBe(counterpart);
    expect(resolveEnvironmentProjectMatch([misleading], selected)).toBeNull();
  });

  it("does not send an ordinary project to a same-named scratch home", () => {
    const selected = makeProject("ordinary-a", "mac", {
      title: "No project",
      workspaceRoot: "/work/scratch",
    });
    const scratch = makeProject("scratch", "server", {
      isScratch: true,
      title: "No project",
      workspaceRoot: "/var/lib/scratch",
    });
    const ordinary = makeProject("ordinary-b", "server", { title: "No project" });
    expect(resolveEnvironmentProjectMatch([scratch, ordinary], selected)).toBe(ordinary);
    expect(resolveEnvironmentProjectMatch([scratch], selected)).toBeNull();
  });
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
    // Without any weaker match the fork is still the first-project fallback.
    expect(resolveEnvironmentProjectMatch([fork], selected)).toBe(fork);
  });

  it("falls back to the first project on the target so the draft has a key to carry over to", () => {
    const selected = makeProject("t3code", "mac", { repositoryKey: "github.com/t3tools/t3code" });
    const target = [makeProject("unrelated", "server"), makeProject("also-unrelated", "server")];
    expect(resolveEnvironmentProjectMatch(target, selected)).toBe(target[0]);
    expect(resolveEnvironmentProjectMatch([], selected)).toBeNull();
  });
});

it("offers one No project scope with both real hosts and selects its preferred member", () => {
  const local = makeProject("scratch-a", "mac", { isScratch: true, title: "No project" });
  const remote = makeProject("scratch-b", "server", { isScratch: true, title: "No project" });
  const ordinary = makeProject("ordinary", "mac", { title: "No project" });
  const scopes = buildHomeProjectScopes({
    projects: [local, ordinary, remote],
    environmentId: null,
    projectGroupingMode: "separate",
  });
  expect(scopes).toHaveLength(2);
  const scratchScope = scopes.find((scope) => scope.representative.isScratch);
  expect(scratchScope?.projects).toEqual([local, remote]);
  expect(getProjectScopeSelectionTarget(scratchScope!, remote.environmentId)).toBe(remote);
  expect(resolveDraftProjectSelection(null, [local, remote], [scratchScope!])).toEqual({
    kind: "select",
    project: local,
  });
});

describe("resolveDraftProjectSelection", () => {
  it("preserves an explicit project selection", () => {
    const project = makeProject("t3code");
    expect(
      resolveDraftProjectSelection("environment:t3code", [project], [makeScope([project])]),
    ).toEqual({ kind: "preserve" });
  });

  it("selects the only physical project when no project was explicitly selected", () => {
    const project = makeProject("t3code");
    expect(resolveDraftProjectSelection(null, [project], [makeScope([project])])).toEqual({
      kind: "select",
      project,
    });
  });

  it("selects one logical project even when it has multiple physical workspaces", () => {
    const projects = [makeProject("t3code"), makeProject("t3code-2"), makeProject("t3code-3")];
    expect(resolveDraftProjectSelection(null, projects, [makeScope(projects)])).toEqual({
      kind: "select",
      project: projects[0],
    });
  });

  it("does not preserve a project key that is missing from the catalog", () => {
    const project = makeProject("t3code");
    expect(
      resolveDraftProjectSelection("environment:removed", [project], [makeScope([project])]),
    ).toEqual({
      kind: "select",
      project,
    });
  });
});

describe("filterProjectScopes", () => {
  const mac = makeProject("code", "mac", { title: "Desktop checkout" });
  const server = makeProject("remote-code", "server", { workspaceRoot: "/srv/remote-workspace" });
  const code = makeScope([mac, server]);
  const docs = { ...makeScope([makeProject("docs")]), key: "docs", title: "Documentation" };
  const scopes = [code, docs];

  it("keeps all projects for an empty or whitespace-only query", () => {
    expect(filterProjectScopes(scopes, "")).toBe(scopes);
    expect(filterProjectScopes(scopes, "  ")).toBe(scopes);
  });

  it("matches logical names and workspace names or paths without case sensitivity", () => {
    expect(filterProjectScopes(scopes, "  T3 CODE ")).toEqual([code]);
    expect(filterProjectScopes(scopes, "DESKTOP")).toEqual([code]);
    expect(filterProjectScopes(scopes, "REMOTE-WORKSPACE")).toEqual([code]);
    expect(filterProjectScopes(scopes, "documentation")).toEqual([docs]);
    expect(filterProjectScopes(scopes, "missing-project")).toEqual([]);
  });

  it("preserves the whole logical project and preferred environment when a workspace matches", () => {
    const matches = filterProjectScopes(scopes, "REMOTE-WORKSPACE");
    expect(matches[0]).toBe(code);
    expect(getProjectScopeSelectionTarget(matches[0]!, EnvironmentId.make("mac"))).toBe(mac);
    expect(code.projects).toEqual([mac, server]);
  });
});
