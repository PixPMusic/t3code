// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId, ProjectId, ProviderInstanceId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS, type ClientSettings } from "@t3tools/contracts/settings";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  environments: [] as Array<{
    environmentId: EnvironmentId;
    label: string;
    displayUrl?: string | null;
    connection: { phase: string };
    serverConfig: {
      scratchWorkspaceRoot: string | null;
      environment: { platform: { machine: "server" } };
    };
  }>,
  projects: [] as EnvironmentProject[],
  ensureScratch: vi.fn(),
  waitForProject: vi.fn(),
  handleNewThread: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("~/state/environments", () => ({
  useEnvironments: () => ({ environments: mocks.environments }),
  usePrimaryEnvironmentId: () => mocks.environments[0]?.environmentId ?? null,
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ state: { location: { href: "/" } } }),
}));
vi.mock("~/state/entities", () => ({
  useProjects: () => mocks.projects,
  useThreadShells: () => [],
  waitForProject: mocks.waitForProject,
}));
vi.mock("~/state/projects", () => ({ projectEnvironment: { ensureScratch: {} } }));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => mocks.ensureScratch }));
vi.mock("~/hooks/useHandleNewThread", () => ({
  useNewThreadHandler: () => mocks.handleNewThread,
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (select: (settings: ClientSettings) => unknown) =>
    select(DEFAULT_CLIENT_SETTINGS),
}));
vi.mock("~/state/server", () => ({ primaryServerKeybindingsAtom: null }));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => [] }));
vi.mock("~/components/ProjectFavicon", () => ({ ProjectFavicon: () => null }));
vi.mock("~/components/ui/toast", () => ({
  stackedThreadToast: (value: unknown) => value,
  toastManager: { add: mocks.toast },
}));

import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { DraftHeroHeadline } from "./DraftHeroHeadline";
import { deriveLogicalProjectKeyFromSettings } from "~/logicalProject";
import { TooltipProvider } from "../ui/tooltip";

const hostA = EnvironmentId.make("host-a");
const hostB = EnvironmentId.make("host-b");
const instanceId = ProviderInstanceId.make("codex");
const draftId = DraftId.make("scratch-host-switch");

function project(environmentId: EnvironmentId, name: string, scratch = false): EnvironmentProject {
  return {
    id: ProjectId.make(`${environmentId}-${name}`),
    environmentId,
    title: name,
    workspaceRoot: `/${environmentId}/${scratch ? "scratch" : name}`,
    repositoryIdentity: null,
    defaultModelSelection: { instanceId, model: scratch ? `${environmentId}-default` : "seeded" },
    scripts: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const regularProject = project(hostA, "My project");
const otherProject = project(hostA, "Other project");
const scratchA = project(hostA, "Scratch", true);
const scratchB = project(hostB, "Scratch", true);
let root: Root;
let container: HTMLDivElement;
let mounted: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  mocks.environments = [hostA, hostB].map((environmentId) => ({
    environmentId,
    label: environmentId === hostA ? "Laptop" : "Build server",
    connection: { phase: "connected" },
    serverConfig: {
      scratchWorkspaceRoot: `/${environmentId}/scratch`,
      environment: { platform: { machine: "server" } },
    },
  }));
  mocks.projects = [regularProject, otherProject, scratchA, scratchB];
  mocks.ensureScratch.mockImplementation(async ({ environmentId }) => ({
    _tag: "Success",
    value: { projectId: environmentId === hostA ? scratchA.id : scratchB.id },
  }));
  mocks.waitForProject.mockImplementation(async ({ environmentId, projectId }) =>
    mocks.projects.find((entry) => entry.environmentId === environmentId && entry.id === projectId),
  );
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
    stickyModelSelectionByProvider: {},
    stickyActiveProvider: null,
  });
  const store = useComposerDraftStore.getState();
  store.setLogicalProjectDraftThreadId(
    deriveLogicalProjectKeyFromSettings(regularProject, DEFAULT_CLIENT_SETTINGS),
    scopeProjectRef(regularProject.environmentId, regularProject.id),
    draftId,
  );
  store.setPrompt(draftId, "Keep this prompt while choosing a host");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderProject(activeProject = regularProject) {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <DraftHeroHeadline
          draftId={draftId}
          activeProjectRef={scopeProjectRef(activeProject.environmentId, activeProject.id)}
          activeProjectTitle={activeProject.title}
        />
      </TooltipProvider>,
    ),
  );
}

async function openMenu() {
  const trigger = document.querySelector<HTMLElement>("[data-draft-project-trigger]");
  expect(trigger).not.toBeNull();
  await act(async () => trigger!.click());
}

async function choose(label: string) {
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")].find(
    (element) => element.textContent === label,
  );
  expect(item, `project choice ${label}`).toBeDefined();
  await act(async () => item!.click());
}

it("switches scratch hosts without losing the prompt or an explicit model choice", async () => {
  const explicitModel = {
    instanceId,
    model: "gpt-5.4",
    options: [{ id: "reasoningEffort", value: "high" }],
  };
  useComposerDraftStore.getState().setModelSelection(draftId, explicitModel, { explicit: true });
  useComposerDraftStore
    .getState()
    .setLogicalProjectDraftThreadId(
      deriveLogicalProjectKeyFromSettings(scratchA, DEFAULT_CLIENT_SETTINGS),
      scopeProjectRef(hostA, scratchA.id),
      draftId,
    );
  await renderProject(scratchA);
  await openMenu();
  await choose("No projectBuild server");

  const store = useComposerDraftStore.getState();
  expect(mocks.ensureScratch).toHaveBeenCalledExactlyOnceWith({ environmentId: hostB, input: {} });
  expect(store.getDraftSession(draftId)).toMatchObject({
    environmentId: hostB,
    projectId: scratchB.id,
  });
  expect(store.getComposerDraft(draftId)).toMatchObject({
    prompt: "Keep this prompt while choosing a host",
    modelSelectionExplicit: true,
    modelSelectionByProvider: { codex: explicitModel },
  });
  await renderProject(scratchB);
  await openMenu();
  const selected = document.querySelector<HTMLElement>("[role=menuitemradio][aria-checked=true]");
  expect(selected?.textContent).toBe("No projectBuild server");
});

it("uses the destination host's default when the model choice was seeded", async () => {
  useComposerDraftStore.getState().setModelSelection(draftId, { instanceId, model: "seeded" });
  await renderProject();
  await openMenu();
  await choose("No projectBuild server");
  expect(useComposerDraftStore.getState().getComposerDraft(draftId)).toMatchObject({
    prompt: "Keep this prompt while choosing a host",
    modelSelectionByProvider: { codex: scratchB.defaultModelSelection },
  });
});

it.each([
  { displayUrl: "http://build-server:3773", suffix: "http://build-server:3773" },
  { displayUrl: null, suffix: "host-b" },
])("routes same-named hosts by their distinct label ($suffix)", async ({ displayUrl, suffix }) => {
  mocks.environments[0]!.label = "Computer";
  mocks.environments[0]!.displayUrl = "http://laptop:3773";
  mocks.environments[1]!.label = "Computer";
  mocks.environments[1]!.displayUrl = displayUrl;
  await renderProject();
  await openMenu();
  await choose(`No projectComputer (${suffix})`);

  const store = useComposerDraftStore.getState();
  expect(mocks.ensureScratch).toHaveBeenCalledExactlyOnceWith({ environmentId: hostB, input: {} });
  expect(store.getDraftSession(draftId)).toMatchObject({
    environmentId: hostB,
    projectId: scratchB.id,
  });
  expect(store.getComposerDraft(draftId)?.prompt).toBe("Keep this prompt while choosing a host");
});

it("keeps a sole connected host's No project choice simple and routes to it", async () => {
  mocks.environments[0]!.connection.phase = "disconnected";
  await renderProject();
  await openMenu();
  await choose("No project");

  expect(mocks.ensureScratch).toHaveBeenCalledExactlyOnceWith({ environmentId: hostB, input: {} });
  expect(useComposerDraftStore.getState().getDraftSession(draftId)).toMatchObject({
    environmentId: hostB,
    projectId: scratchB.id,
  });
});

it("only offers connected hosts that support scratch folders", async () => {
  mocks.environments.push(
    {
      ...mocks.environments[0]!,
      environmentId: EnvironmentId.make("offline"),
      label: "Laptop",
      connection: { phase: "disconnected" },
    },
    {
      ...mocks.environments[0]!,
      environmentId: EnvironmentId.make("older"),
      label: "Build server",
      serverConfig: { ...mocks.environments[0]!.serverConfig, scratchWorkspaceRoot: null },
    },
  );
  await renderProject();
  await openMenu();
  const scratchLabels = [...document.querySelectorAll("[role=menuitemradio]")]
    .map((item) => item.textContent)
    .filter((label) => label?.startsWith("No project"));
  expect(scratchLabels).toEqual(["No projectLaptop", "No projectBuild server"]);
});

function deferScratch() {
  let resolve = (_value: { _tag: "Success"; value: { projectId: ProjectId } }) => {};
  const promise = new Promise<{ _tag: "Success"; value: { projectId: ProjectId } }>((finish) => {
    resolve = finish;
  });
  mocks.ensureScratch.mockReturnValueOnce(promise);
  return async (scratch: EnvironmentProject) => {
    await act(async () => resolve({ _tag: "Success", value: { projectId: scratch.id } }));
  };
}

it("keeps the latest scratch host when an older host request finishes later", async () => {
  const finishFirst = deferScratch();
  const finishSecond = deferScratch();
  await renderProject();
  await openMenu();
  await choose("No projectLaptop");
  await openMenu();
  await choose("No projectBuild server");
  await finishSecond(scratchB);
  await finishFirst(scratchA);
  expect(useComposerDraftStore.getState().getDraftSession(draftId)).toMatchObject({
    environmentId: hostB,
    projectId: scratchB.id,
  });
});

it("does not replace a newer project selection when a scratch request finishes", async () => {
  const finish = deferScratch();
  await renderProject();
  await openMenu();
  await choose("No projectBuild server");
  await openMenu();
  await choose("Other project");
  await finish(scratchB);
  expect(useComposerDraftStore.getState().getDraftSession(draftId)?.projectId).toBe(
    otherProject.id,
  );
});

it("does not retarget a draft after the headline unmounts", async () => {
  const finish = deferScratch();
  await renderProject();
  await openMenu();
  await choose("No projectBuild server");
  await act(async () => root.unmount());
  mounted = false;
  await finish(scratchB);
  expect(useComposerDraftStore.getState().getDraftSession(draftId)?.projectId).toBe(
    regularProject.id,
  );
});
