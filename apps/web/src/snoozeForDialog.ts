export interface SnoozeForDialogRequest {
  readonly threadCount?: number;
  readonly onSnooze: (snoozedUntil: string) => Promise<boolean>;
}

export type SnoozeForDialogState =
  | { readonly status: "idle" }
  | {
      readonly status: "open";
      readonly id: number;
      readonly threadCount: number;
      readonly onSnooze: SnoozeForDialogRequest["onSnooze"];
    };

const idleState: SnoozeForDialogState = { status: "idle" };
let state: SnoozeForDialogState = idleState;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: SnoozeForDialogState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function readSnoozeForDialogState(): SnoozeForDialogState {
  return state;
}

export function subscribeSnoozeForDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openSnoozeForDialog(request: SnoozeForDialogRequest): void {
  publish({
    status: "open",
    id: nextId++,
    threadCount: request.threadCount ?? 1,
    onSnooze: request.onSnooze,
  });
}

export function closeSnoozeForDialog(requestId?: number): void {
  if (requestId !== undefined && (state.status !== "open" || state.id !== requestId)) return;
  publish(idleState);
}
