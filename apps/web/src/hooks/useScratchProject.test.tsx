import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  router: { state: { location: { href: "/" } } },
  ensureScratch: vi.fn(),
  waitForProject: vi.fn(),
  handleNewThread: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => mocks.router }));
vi.mock("~/state/environments", () => ({ useEnvironments: () => ({ environments: [] }) }));
vi.mock("~/state/entities", () => ({ waitForProject: mocks.waitForProject }));
vi.mock("~/state/projects", () => ({ projectEnvironment: { ensureScratch: {} } }));
vi.mock("~/state/use-atom-command", () => ({ useAtomCommand: () => mocks.ensureScratch }));
vi.mock("./useHandleNewThread", () => ({ useNewThreadHandler: () => mocks.handleNewThread }));
vi.mock("~/components/ui/toast", () => ({
  stackedThreadToast: (value: unknown) => value,
  toastManager: { add: vi.fn() },
}));

import { useScratchProject } from "./useScratchProject";

const hostA = EnvironmentId.make("host-a");
const hostB = EnvironmentId.make("host-b");
function scratchProject(environmentId: EnvironmentId): EnvironmentProject {
  return {
    environmentId,
    id: ProjectId.make(`${environmentId}-scratch`),
    title: "Scratch",
    workspaceRoot: `/${environmentId}/scratch`,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

let renderer: ReactTestRenderer | null;
function HookOutput(_props: { view: ReturnType<typeof useScratchProject> }) {
  return null;
}
function Surface() {
  return <HookOutput view={useScratchProject()} />;
}
function mount() {
  act(() => {
    renderer = create(<Surface />);
  });
  return renderer!.root.findByType(HookOutput).props.view as ReturnType<typeof useScratchProject>;
}
async function unmount() {
  await act(async () => renderer?.unmount());
  renderer = null;
}

function deferredScratch(project: EnvironmentProject) {
  const value = { _tag: "Success" as const, value: { projectId: project.id } };
  let resolve = (_value: typeof value) => {};
  const promise = new Promise<typeof value>((finish) => {
    resolve = finish;
  });
  return { promise, finish: () => resolve(value) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  renderer = null;
  mocks.router.state.location.href = "/";
  mocks.handleNewThread.mockResolvedValue(undefined);
  mocks.waitForProject.mockImplementation(async ({ environmentId }) =>
    scratchProject(environmentId),
  );
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
});

it.each(["latest-first", "older-first"])(
  "only creates on the latest host across reopened palette instances (%s)",
  async (order) => {
    const firstResponse = deferredScratch(scratchProject(hostA));
    const secondResponse = deferredScratch(scratchProject(hostB));
    mocks.ensureScratch
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);
    const firstRequest = mount().startScratchThread(hostA);
    await unmount();
    const secondRequest = mount().startScratchThread(hostB);

    if (order === "latest-first") {
      secondResponse.finish();
      await secondRequest;
      firstResponse.finish();
      await firstRequest;
    } else {
      firstResponse.finish();
      await firstRequest;
      expect(mocks.handleNewThread).not.toHaveBeenCalled();
      secondResponse.finish();
      await secondRequest;
    }

    expect(mocks.handleNewThread).toHaveBeenCalledExactlyOnceWith({
      environmentId: hostB,
      projectId: scratchProject(hostB).id,
    });
  },
);

it("does not navigate when the user changes routes while scratch creation is pending", async () => {
  const response = deferredScratch(scratchProject(hostA));
  mocks.ensureScratch.mockReturnValueOnce(response.promise);
  const request = mount().startScratchThread(hostA);
  mocks.router.state.location.href = "/usage";
  response.finish();
  await request;

  expect(mocks.handleNewThread).not.toHaveBeenCalled();
  expect(mocks.router.state.location.href).toBe("/usage");
});

it("creates normally after the initiating palette hook unmounts", async () => {
  const response = deferredScratch(scratchProject(hostA));
  mocks.ensureScratch.mockReturnValueOnce(response.promise);
  const request = mount().startScratchThread(hostA);
  await unmount();
  response.finish();
  await request;

  expect(mocks.ensureScratch).toHaveBeenCalledExactlyOnceWith({ environmentId: hostA, input: {} });
  expect(mocks.handleNewThread).toHaveBeenCalledExactlyOnceWith({
    environmentId: hostA,
    projectId: scratchProject(hostA).id,
  });
});
