import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";

import { makeThreadShellFixture } from "../../test-fixtures";
import { useThreadListV2 } from "./useThreadListV2";

vi.mock("../../state/olderSettledShelf", () => {
  const isListed = () => true;
  const unloadedCount = () => 0;
  return {
    useOlderSettledShelf: () => ({ isListed, unloadedCount }),
    useOlderSettledShelfGrowth: () => undefined,
  };
});

it("reuses a large thread list across tab renders and updates when its inputs change", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
  const environmentId = EnvironmentId.make("environment-1");
  const otherEnvironmentId = EnvironmentId.make("environment-2");
  const threads = Array.from({ length: 1200 }, (_, index) =>
    makeThreadShellFixture({
      id: ThreadId.make(`thread-${index}`),
      title: `Thread ${index}`,
      environmentId: index % 2 === 0 ? environmentId : otherEnvironmentId,
      settledOverride: index < 150 ? "active" : "settled",
      settledAt: index < 150 ? null : "2026-01-01T00:00:00.000Z",
    }),
  );
  const environmentIds = new Set([environmentId, otherEnvironmentId]);
  const input: Parameters<typeof useThreadListV2>[0] = {
    threads,
    pendingTasks: [],
    environmentId: null,
    projectRefs: null,
    searchQuery: "",
    searchMatches: new Map(),
    settlementEnvironmentIds: environmentIds,
    snoozeEnvironmentIds: environmentIds,
    pinReorderEnvironmentIds: environmentIds,
    activeReorderEnvironmentIds: environmentIds,
    queuedThreadKeys: new Set(),
    settledLimit: 10,
    now: "2026-01-02T00:00:00.000Z",
    pendingOrder: null,
    shelfPreferencesLoaded: true,
    workingShelfEnabled: true,
    workingShelfExpanded: false,
    snoozedShelfExpanded: false,
    settledShelfExpanded: true,
    selectedThreadKey: null,
  };
  const seen: Array<ReturnType<typeof useThreadListV2>> = [];
  function Probe(props: { input: typeof input; tab: string }) {
    const result = useThreadListV2(props.input);
    useLayoutEffect(() => {
      seen.push(result);
    });
    return <div>{props.tab}</div>;
  }

  const root = createRoot(document.createElement("div"));
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  await act(async () => root.render(<Probe input={{ ...input }} tab="chats" />));
  const initial = seen.at(-1)!;
  expect(initial.layout.items).toHaveLength(160);
  expect(initial.layout.settledCount).toBe(1050);

  for (const tab of ["pullRequests", "chats", "settings", "chats"]) {
    await act(async () => root.render(<Probe input={{ ...input }} tab={tab} />));
    expect(seen.at(-1)!.layout).toBe(initial.layout);
    expect(seen.at(-1)!.items).toBe(initial.items);
  }

  await act(async () => root.render(<Probe input={{ ...input, environmentId }} tab="chats" />));
  expect(seen.at(-1)!.layout.items).toHaveLength(85);
  expect(seen.at(-1)!.layout.settledCount).toBe(525);
  expect(
    seen.at(-1)!.layout.items.every((item) => item.thread.environmentId === environmentId),
  ).toBe(true);

  const queuedThreadKeys = new Set([`${environmentId}:thread-150`]);
  await act(async () => root.render(<Probe input={{ ...input, queuedThreadKeys }} tab="chats" />));
  const queued = seen.at(-1)!;
  expect(queued.layout.items).toHaveLength(161);
  expect(queued.layout.settledCount).toBe(1049);
  expect(
    queued.items.find((item) => item.type === "v2-thread" && item.item.thread.id === "thread-150"),
  ).toMatchObject({ hasQueuedMessages: true, item: { variant: "card" } });

  await act(async () => root.render(<Probe input={{ ...input, settledLimit: 35 }} tab="chats" />));
  expect(seen.at(-1)!.layout.items).toHaveLength(185);

  const updatedThreads = threads.map((thread) =>
    thread.id === "thread-0" ? { ...thread, title: "Updated title" } : thread,
  );
  await act(async () =>
    root.render(<Probe input={{ ...input, threads: updatedThreads }} tab="chats" />),
  );
  expect(
    seen.at(-1)!.layout.items.find((item) => item.thread.id === "thread-0")?.thread.title,
  ).toBe("Updated title");

  await act(async () =>
    root.render(
      <Probe
        input={{ ...input, threads: updatedThreads, searchQuery: "Updated title" }}
        tab="chats"
      />,
    ),
  );
  expect(seen.at(-1)!.layout.items.map((item) => item.thread.title)).toEqual(["Updated title"]);

  await act(async () =>
    root.render(<Probe input={{ ...input, now: "2026-01-02T00:01:00.000Z" }} tab="chats" />),
  );
  expect(seen.at(-1)!.items).not.toBe(initial.items);
});
