import { resolveSnoozeForDefault } from "@t3tools/client-runtime/state/thread-settled";
import { type FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  closeSnoozeForDialog,
  readSnoozeForDialogState,
  subscribeSnoozeForDialog,
  type SnoozeForDialogState,
} from "../snoozeForDialog";
import { formatSnoozeForInput, parseSnoozeForInput } from "./Sidebar.snooze";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const FORM_ID = "snooze-for-form";

export function SnoozeForForm(props: {
  readonly request: Extract<SnoozeForDialogState, { readonly status: "open" }>;
}) {
  const { request } = props;
  const [input, setInput] = useState(() =>
    formatSnoozeForInput(resolveSnoozeForDefault(new Date())),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    // Re-read the clock here: a valid value can expire while the dialog is open.
    const result = parseSnoozeForInput(input, { now: new Date() });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    let succeeded = false;
    try {
      succeeded = await request.onSnooze(result.value.toISOString());
      if (succeeded) {
        closeSnoozeForDialog(request.id);
      } else {
        setError("Could not snooze. Check the selected time and try again.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not snooze. Try again.");
    } finally {
      if (!succeeded) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Snooze until</DialogTitle>
        <DialogDescription>
          Choose when {request.threadCount === 1 ? "this thread" : "these threads"} should return to
          your inbox.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <form id={FORM_ID} className="space-y-2" noValidate onSubmit={submit}>
          <Label htmlFor="snooze-for-time">Date and time</Label>
          <Input
            id="snooze-for-time"
            type="datetime-local"
            step={15 * 60}
            autoFocus
            disabled={isSubmitting}
            value={input}
            aria-invalid={error !== null}
            aria-describedby={error ? "snooze-for-error" : undefined}
            onChange={(event) => {
              setInput(event.currentTarget.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id="snooze-for-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => closeSnoozeForDialog(request.id)}>
          Cancel
        </Button>
        <Button form={FORM_ID} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Snoozing…" : "Snooze"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function SnoozeForDialogHost() {
  const state = useSyncExternalStore(
    subscribeSnoozeForDialog,
    readSnoozeForDialogState,
    readSnoozeForDialogState,
  );
  const [closingRequest, setClosingRequest] = useState<Extract<
    SnoozeForDialogState,
    { readonly status: "open" }
  > | null>(null);

  useEffect(() => {
    if (state.status === "open") setClosingRequest(state);
  }, [state]);

  const request = state.status === "open" ? state : closingRequest;

  return (
    <Dialog
      open={state.status === "open"}
      onOpenChange={(open) => {
        if (!open) closeSnoozeForDialog();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setClosingRequest(null);
      }}
    >
      <DialogPopup className="max-w-sm">
        {request ? <SnoozeForForm key={request.id} request={request} /> : null}
      </DialogPopup>
    </Dialog>
  );
}
