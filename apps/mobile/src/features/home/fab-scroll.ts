export interface FabScrollState {
  readonly anchor: number;
  readonly expanded: boolean;
}

/** Ignore small direction changes and overscroll; always show the label at the top. */
export function updateFabScroll(
  state: FabScrollState,
  offset: number,
  maxOffset: number,
): FabScrollState {
  const y = Math.max(0, Math.min(offset, Math.max(0, maxOffset)));
  if (y <= 8) return { anchor: y, expanded: true };
  const anchor = state.expanded ? Math.min(state.anchor, y) : Math.max(state.anchor, y);
  if (Math.abs(y - anchor) >= 12) return { anchor: y, expanded: !state.expanded };
  return { anchor, expanded: state.expanded };
}

export interface ChromeScrollState extends FabScrollState {
  readonly settleUntil: number;
}

/**
 * Like updateFabScroll, for chrome whose show/hide moves the list under the finger. That
 * move reads as scrolling the other way and would flip the chrome back during a slow
 * drag, so offsets only re-anchor until the transition has had `settleMs` to finish. The
 * chrome also stays until the list is `minHideOffset` down: hiding nearer the top would
 * shift the list back to its start, reading as a pull to refresh and a return to the top.
 */
export function updateChromeScroll(
  state: ChromeScrollState,
  offset: number,
  maxOffset: number,
  now: number,
  settleMs: number,
  minHideOffset: number,
): ChromeScrollState {
  if (now < state.settleUntil) {
    return { ...state, anchor: Math.max(0, Math.min(offset, Math.max(0, maxOffset))) };
  }
  const next = updateFabScroll(state, offset, maxOffset);
  if (state.expanded && !next.expanded && offset < minHideOffset) {
    return { ...state, anchor: next.anchor };
  }
  return {
    ...next,
    settleUntil: next.expanded === state.expanded ? state.settleUntil : now + settleMs,
  };
}
