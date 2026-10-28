import {
  ProviderDriverKind,
  type ProviderOptionDescriptor,
  type ProviderOptionSelection,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { readPromptUltrathink, TraitsMenuContent } from "./TraitsPicker";

const levels = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium", isDefault: true },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
  { id: "max", label: "Max" },
  { id: "ultra", label: "Ultra" },
];

function EffortMenu({
  options = levels,
  prompt = "",
}: {
  options?: typeof levels;
  prompt?: string;
}) {
  const [modelOptions, setModelOptions] = useState<
    ReadonlyArray<ProviderOptionSelection> | undefined
  >([{ id: "serviceTier", value: "fast" }]);
  const descriptors: ReadonlyArray<ProviderOptionDescriptor> = [
    {
      id: "reasoningEffort",
      label: "Reasoning",
      type: "select",
      currentValue: "medium",
      options,
      promptInjectedValues: ["ultrathink"],
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      currentValue: "standard",
      options: [
        { id: "standard", label: "Standard" },
        { id: "fast", label: "Fast" },
      ],
    },
  ];
  const models: ReadonlyArray<ServerProviderModel> = [
    {
      slug: "test",
      name: "Test",
      isCustom: false,
      capabilities: { optionDescriptors: descriptors },
    },
  ];
  return (
    <>
      <Menu>
        <MenuTrigger>Effort</MenuTrigger>
        <MenuPopup>
          <TraitsMenuContent
            provider={ProviderDriverKind.make("codex")}
            models={models}
            model="test"
            modelOptions={modelOptions}
            onModelOptionsChange={setModelOptions}
            promptUltrathink={readPromptUltrathink(prompt)}
            planModeEnabled
            isComposerOwned
          />
        </MenuPopup>
      </Menu>
      <output>{JSON.stringify(modelOptions)}</output>
    </>
  );
}

it.each([2, 6])(
  "steps through %i model levels and keeps the other traits and menu navigation",
  async (count) => {
    const options = levels.slice(0, count);
    // The menu has no routing behavior.
    await using screen = await render(<EffortMenu options={options} />, { router: false });
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    const slider = page.getByRole("slider", { name: "Reasoning" });
    await expect.element(slider).toHaveFocus();
    await expect.element(slider).toHaveAttribute("max", String(count - 1));
    await expect.element(slider).toHaveAttribute("aria-valuetext", "Medium (default)");

    await userEvent.keyboard("{Home}");
    for (const [index, option] of options.entries()) {
      if (index > 0) await userEvent.keyboard("{ArrowRight}");
      await expect
        .element(slider)
        .toHaveAttribute(
          "aria-valuetext",
          `${option.label}${option.isDefault ? " (default)" : ""}`,
        );
      await expect.element(screen.getByRole("status")).toHaveTextContent(
        JSON.stringify([
          { id: "reasoningEffort", value: option.id },
          { id: "serviceTier", value: "fast" },
        ]),
      );
    }
    await userEvent.keyboard("{ArrowLeft}{End}");
    await expect.element(slider).toHaveValue(String(count - 1));
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(page.getByRole("menuitemradio", { name: "Standard" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    await expect.element(slider).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("button", { name: "Effort" })).toHaveFocus();
  },
);

it("keeps prompt-controlled Ultrathink disabled", async () => {
  const options = [...levels, { id: "ultrathink", label: "Ultrathink" }];
  // The menu has no routing behavior.
  await using screen = await render(
    <EffortMenu options={options} prompt="Please ultrathink about this" />,
    {
      router: false,
    },
  );
  await userEvent.click(screen.getByRole("button", { name: "Effort" }));
  await expect.element(page.getByRole("slider", { name: "Reasoning" })).toBeDisabled();
  await expect
    .element(page.getByRole("slider", { name: "Reasoning" }))
    .toHaveAttribute("aria-valuetext", "Ultrathink");
});
