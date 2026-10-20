import "~/index.css";

import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import type { ClientSettings } from "@t3tools/contracts";

vi.mock("~/hooks/useSettings", () => ({
  useEnvironmentIdentificationMode: () => "none",
}));
vi.mock("../SidebarStageBackdrop", () => ({
  StageBackdropButtonArt: () => null,
  useSidebarStageBackdropVariant: () => null,
}));

import { render } from "../../../test/render";
import { ComposerPrimaryActions } from "./ComposerPrimaryActions";
import { useResumeCompactionSelection } from "./useResumeCompactionSelection";

function ResumeCompactionActions(props: {
  preference: ClientSettings["automaticCompactionSuggestions"];
  threadKey?: string;
}) {
  const threadKey = props.threadKey ?? "thread-1";
  const { keepFullHistory, setKeepFullHistory, defaultKeepFullHistory } =
    useResumeCompactionSelection(props.preference, threadKey);
  return (
    <ComposerPrimaryActions
      compact={false}
      canOperateThread
      pendingAction={null}
      isRunning={false}
      canInterrupt={false}
      showPlanFollowUpPrompt={false}
      promptHasText
      isSendBusy={false}
      sendDisabledReason={null}
      isConnecting={false}
      isEnvironmentUnavailable={false}
      isPreparingWorktree={false}
      hasSendableContent
      onPreviousPendingQuestion={() => {}}
      onInterrupt={() => {}}
      onImplementPlanInNewThread={() => {}}
      compactBeforeSendTokens={props.preference === "disabled" ? null : 250_000}
      keepFullHistory={keepFullHistory}
      onToggleKeepFullHistory={() => setKeepFullHistory(threadKey, !keepFullHistory)}
      onSubmitMessage={() => setKeepFullHistory(threadKey, defaultKeepFullHistory)}
    />
  );
}

const compactionChip = () =>
  page.getByRole("button", { name: "Compact 250k tokens of history before sending" });

it.each(["on", "off"] as const)(
  "uses the %s default, allows an override, and restores the default after sending",
  async (preference) => {
    await using _screen = await render(<ResumeCompactionActions preference={preference} />);
    const selected = preference === "on";
    await expect.element(compactionChip()).toHaveAttribute("aria-pressed", String(selected));
    await expect
      .element(page.getByRole("button", { name: selected ? "Compact and send" : "Submit message" }))
      .toBeVisible();

    await userEvent.click(compactionChip());
    await expect.element(compactionChip()).toHaveAttribute("aria-pressed", String(!selected));
    await userEvent.click(
      page.getByRole("button", { name: selected ? "Submit message" : "Compact and send" }),
    );
    await expect.element(compactionChip()).toHaveAttribute("aria-pressed", String(selected));
  },
);

it("keeps overrides local to each thread and clears them when the preference changes", async () => {
  await using screen = await render(<ResumeCompactionActions preference="off" />);
  await userEvent.click(compactionChip());
  await expect.element(compactionChip()).toHaveAttribute("aria-pressed", "true");

  await screen.rerender(<ResumeCompactionActions preference="off" threadKey="thread-2" />);
  await expect.element(compactionChip()).toHaveAttribute("aria-pressed", "false");
  await screen.rerender(<ResumeCompactionActions preference="off" />);
  await expect.element(compactionChip()).toHaveAttribute("aria-pressed", "true");

  await screen.rerender(<ResumeCompactionActions preference="disabled" />);
  await expect.element(compactionChip()).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Submit message" })).toBeVisible();
  await screen.rerender(<ResumeCompactionActions preference="off" />);
  await expect.element(compactionChip()).toHaveAttribute("aria-pressed", "false");
});

it("opens implementation actions with a mouse while the composer is resting", async () => {
  const onImplementPlanInNewThread = vi.fn();
  await using _screen = await render(
    <ComposerPrimaryActions
      compact={false}
      canOperateThread
      pendingAction={null}
      isRunning={false}
      canInterrupt={false}
      showPlanFollowUpPrompt
      promptHasText={false}
      isSendBusy={false}
      sendDisabledReason={null}
      isConnecting={false}
      isEnvironmentUnavailable={false}
      isPreparingWorktree={false}
      hasSendableContent={false}
      preserveComposerFocusOnPointerDown
      onPreviousPendingQuestion={() => {}}
      onInterrupt={() => {}}
      onImplementPlanInNewThread={onImplementPlanInNewThread}
    />,
  );

  await userEvent.click(page.getByRole("button", { name: "Implementation actions" }));
  const item = page.getByRole("menuitem", { name: "Implement in a new thread" });
  await expect.element(item).toBeVisible();
  await userEvent.click(item);
  expect(onImplementPlanInNewThread).toHaveBeenCalledTimes(1);
});
