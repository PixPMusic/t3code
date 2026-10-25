import { act, createContext, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ split: false }));

vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaInsetsContext: createContext({ top: 0, right: 0, bottom: 24, left: 0 }),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));
vi.mock("../layout/AdaptiveWorkspaceLayout", () => ({
  useAdaptiveWorkspaceLayout: () => ({
    layout: { usesSplitView: mocks.split },
    startNewTask: () => undefined,
  }),
}));
vi.mock("./navigation-tabs", () => ({
  useEnabledNavigationTabs: () => ["threads", "pullRequests", "usage"],
}));
vi.mock("./WorkspaceTabsContext", () => ({
  WorkspaceTabsContext: createContext(null),
  useWorkspaceTabs: () => ({ state: { selectedTab: "usage" } }),
}));
vi.mock("./WorkspaceExtraTab", () => ({
  WorkspaceExtraTab: function UsageProbe() {
    const [tab, setTab] = useState("Limits");
    const [filters, setFilters] = useState("30d / Cost / All environments");
    return (
      <div data-testid="usage-scroll">
        <button onClick={() => setTab("Usage")}>{tab}</button>
        <input value={filters} onChange={(event) => setFilters(event.target.value)} />
      </div>
    );
  },
}));
vi.mock("../../native/StackHeader", () => ({ NativeStackScreenOptions: () => null }));
vi.mock("../../components/ui/AndroidScreenHeader", () => ({ AndroidScreenHeader: () => null }));
vi.mock("../../components/ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("../../components/ui/ScreenContent", () => ({
  ScreenContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/ui/useAndroidControlSizing", () => ({
  useAndroidControlSizing: () => ({ fabClearance: 64 }),
}));
vi.mock("../home/HomeRouteScreen", () => ({ HomeRouteScreen: () => null }));
vi.mock("../pull-requests/PullRequestFilterMenuContext", () => ({
  PullRequestFilterMenuProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../pull-requests/PullRequestsScreen", () => ({ PullRequestsScreen: () => null }));
vi.mock("../pull-requests/PullRequestToolbar.android", () => ({ PullRequestToolbar: () => null }));
vi.mock("./AndroidWorkspaceNavigation", () => ({ AndroidWorkspaceNavigation: () => null }));
vi.mock("./WorkspaceNoTabs", () => ({ WorkspaceNoTabs: () => null }));

import { WorkspaceRootScreen } from "./WorkspaceRootScreen.android";

function setup(split: boolean) {
  mocks.split = split;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  return { [Symbol.dispose]: () => vi.unstubAllGlobals() };
}

it.each([false, true])(
  "keeps the Usage page, filters, and scroll container through fold transitions (split: %s)",
  async (split) => {
    using _actEnvironment = setup(split);
    const container = document.createElement("div");
    const root = createRoot(container);
    using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
    await act(async () => root.render(<WorkspaceRootScreen />));

    const button = container.querySelector("button")!;
    await act(async () => button.click());
    const input = container.querySelector("input")!;
    const filters = "7d / Tokens / Demo Workstation";
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        filters,
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button.textContent).toBe("Usage");
    expect(input.value).toBe(filters);
    const scroll = container.querySelector<HTMLElement>('[data-testid="usage-scroll"]')!;
    scroll.scrollTop = 240;

    for (const nextSplit of [!split, split, !split, split]) {
      mocks.split = nextSplit;
      await act(async () => root.render(<WorkspaceRootScreen />));
      expect(container.querySelector("button")?.textContent).toBe("Usage");
      expect(container.querySelector("input")?.value).toBe(filters);
      expect(container.querySelector('[data-testid="usage-scroll"]')).toBe(scroll);
      expect(scroll.scrollTop).toBe(240);
    }
  },
);
