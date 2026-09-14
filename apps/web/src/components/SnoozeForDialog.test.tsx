import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  closeSnoozeForDialog,
  openSnoozeForDialog,
  readSnoozeForDialogState,
} from "../snoozeForDialog";
import { visitElements } from "../test/reactElementTree";
import { reactHookHarness as hooks } from "../test/reactHookHarness";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../test/reactHookHarness");
  return {
    ...actual,
    useRef: reactHookHarness.useRef,
    useState: reactHookHarness.useState,
  };
});

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

import { SnoozeForForm } from "./SnoozeForDialog";

const chosenTime = "2026-04-08T17:45";

function pendingSnooze() {
  let resolve!: (succeeded: boolean) => void;
  const promise = new Promise<boolean>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function renderForm() {
  const request = readSnoozeForDialogState();
  if (request.status !== "open") throw new Error("Expected an open snooze dialog");
  hooks.beginRender();
  const tree = SnoozeForForm({ request });
  const form = visitElements(tree, (element) => element.type === "form") as ReactElement<{
    onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  }>;
  const input = visitElements(
    tree,
    (element) => element.props.id === "snooze-for-time",
  ) as ReactElement<{
    value: string;
    disabled: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  }>;
  return {
    input: input.props,
    error: visitElements(tree, (element) => element.props.id === "snooze-for-error")?.props
      .children,
    submit: () => form.props.onSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>),
  };
}

function chooseTime() {
  renderForm().input.onChange({
    currentTarget: { value: chosenTime },
  } as ChangeEvent<HTMLInputElement>);
  return renderForm();
}

describe("custom snooze submission", () => {
  beforeEach(() => {
    hooks.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 8, 10));
  });

  afterEach(() => {
    closeSnoozeForDialog();
    vi.useRealTimers();
  });

  it("waits for acceptance and ignores a second submission before React rerenders", async () => {
    const pending = pendingSnooze();
    const onSnooze = vi.fn(() => pending.promise);
    openSnoozeForDialog({ onSnooze });
    const form = chooseTime();

    const submitted = form.submit();
    await form.submit();
    expect(onSnooze).toHaveBeenCalledExactlyOnceWith(new Date(2026, 3, 8, 17, 45).toISOString());
    expect(readSnoozeForDialogState().status).toBe("open");
    expect(renderForm().input.disabled).toBe(true);

    pending.resolve(true);
    await submitted;
    expect(readSnoozeForDialogState().status).toBe("idle");
  });

  it.each([false, new Error("Server rejected the wake time")])(
    "retains input after a rejected submission and allows retry: %s",
    async (failure) => {
      const onSnooze = vi.fn<() => Promise<boolean>>();
      if (failure instanceof Error) onSnooze.mockRejectedValueOnce(failure);
      else onSnooze.mockResolvedValueOnce(failure);
      onSnooze.mockResolvedValueOnce(true);
      openSnoozeForDialog({ onSnooze });

      await chooseTime().submit();
      expect(readSnoozeForDialogState().status).toBe("open");
      const retry = renderForm();
      expect(retry.input.value).toBe(chosenTime);
      expect(retry.input.disabled).toBe(false);
      expect(retry.error).toEqual(expect.any(String));

      await retry.submit();
      expect(onSnooze).toHaveBeenCalledTimes(2);
      expect(readSnoozeForDialogState().status).toBe("idle");
    },
  );

  it("does not close a newer dialog when a dismissed request finishes", async () => {
    const pending = pendingSnooze();
    openSnoozeForDialog({ onSnooze: () => pending.promise });
    const submitted = chooseTime().submit();
    closeSnoozeForDialog();
    openSnoozeForDialog({ onSnooze: vi.fn(async () => true) });
    const newerRequest = readSnoozeForDialogState();

    pending.resolve(true);
    await submitted;
    expect(readSnoozeForDialogState()).toBe(newerRequest);
  });
});
