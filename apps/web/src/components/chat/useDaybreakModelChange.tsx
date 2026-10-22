import { useState } from "react";
import {
  decideDaybreakModelChange,
  DAYBREAK_OPTION_ID,
} from "@t3tools/client-runtime/model-traits";
import type {
  ModelSelection,
  ProviderOptionDescriptor,
  ProviderOptionSelection,
} from "@t3tools/contracts";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../ui/alert-dialog";

type PendingChange = {
  currentOptions: ReadonlyArray<ProviderOptionSelection> | null | undefined;
  target: ModelSelection;
  commit: (selection: ModelSelection) => void;
  clearsDaybreak?: boolean;
  destinationContext?: string | undefined;
  contextKey: string;
};

export function useDaybreakModelChange(
  getDescriptors: (
    selection: ModelSelection,
    destinationContext?: string,
  ) => ReadonlyArray<ProviderOptionDescriptor> | null,
  contextKey: string,
) {
  const [pendingChange, setPending] = useState<PendingChange | null>(null);
  const pending = pendingChange?.contextKey === contextKey ? pendingChange : null;
  if (pendingChange && pendingChange.contextKey !== contextKey) setPending(null);
  const decide = (change: PendingChange) => {
    const descriptors = change.clearsDaybreak
      ? []
      : getDescriptors(change.target, change.destinationContext);
    return descriptors === null
      ? null
      : decideDaybreakModelChange(change.currentOptions, change.target, descriptors);
  };
  const requestModelChange = (
    currentOptions: PendingChange["currentOptions"],
    target: ModelSelection,
    commit: PendingChange["commit"],
    clearsDaybreak = false,
    destinationContext?: string,
  ) => {
    const change = {
      currentOptions,
      target,
      commit,
      clearsDaybreak,
      contextKey,
      destinationContext,
    };
    const decision = decide(change);
    if (!decision) return;
    if (decision.type === "ready") commit(decision.selection);
    else setPending(change);
  };
  const decision = pending ? decide(pending) : null;
  const choose = (selection: ModelSelection) => {
    if (!pending) return;
    // A catalog refresh can revoke an offered program while the dialog is open.
    const latest = decide(pending);
    if (!latest) return;
    const program = selection.options?.find((option) => option.id === DAYBREAK_OPTION_ID)?.value;
    const accepted =
      latest.type === "ready"
        ? latest.selection
        : latest.choices.find(
            (choice) =>
              choice.selection.options?.find((option) => option.id === DAYBREAK_OPTION_ID)
                ?.value === program,
          )?.selection;
    if (!accepted) {
      setPending({ ...pending });
      return;
    }
    setPending(null);
    pending.commit(accepted);
  };
  const daybreakDialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Daybreak program?</AlertDialogTitle>
          <AlertDialogDescription>
            {decision?.type === "confirm"
              ? pending?.clearsDaybreak
                ? `Resetting the default model clears its saved ${decision.activeLabel} selection.`
                : `${decision.activeLabel} is not available for the selected model and account. Choose how to continue.`
              : decision
                ? "Daybreak availability has changed. Confirm the model change to continue."
                : "This model or account is no longer available. Cancel and choose another model."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>
            Cancel
          </Button>
          {decision?.type === "confirm" ? (
            decision.choices.map((choice) => (
              <Button key={choice.label} onClick={() => choose(choice.selection)}>
                {pending?.clearsDaybreak ? "Reset default" : choice.label}
              </Button>
            ))
          ) : decision ? (
            <Button onClick={() => choose(decision.selection)}>Switch model</Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
  return { requestModelChange, daybreakDialog };
}
