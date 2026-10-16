import { describe, expect, it } from "vite-plus/test";

import {
  updateChromeScroll,
  updateFabScroll,
  type ChromeScrollState,
  type FabScrollState,
} from "./fab-scroll";

describe("Material FAB scroll direction", () => {
  const initial: FabScrollState = { anchor: 0, expanded: true };

  it("shrinks scrolling down and expands scrolling up without returning to the top", () => {
    const collapsed = updateFabScroll(initial, 80, 500);
    expect(collapsed.expanded).toBe(false);
    const lower = updateFabScroll(collapsed, 180, 500);
    expect(lower.expanded).toBe(false);
    expect(updateFabScroll(lower, 160, 500).expanded).toBe(true);
  });

  it("accumulates travel but ignores jitter around a direction change", () => {
    let state = updateFabScroll(initial, 10, 500);
    expect(state.expanded).toBe(true);
    state = updateFabScroll(state, 14, 500);
    expect(state.expanded).toBe(false);
    state = updateFabScroll(state, 100, 500);
    state = updateFabScroll(state, 95, 500);
    state = updateFabScroll(state, 98, 500);
    expect(state.expanded).toBe(false);
    expect(updateFabScroll(state, 88, 500).expanded).toBe(true);
  });

  it("does not expand from bottom bounce or collapse from top bounce", () => {
    const bottom = updateFabScroll(initial, 500, 500);
    const bounce = updateFabScroll(bottom, 560, 500);
    expect(updateFabScroll(bounce, 500, 500).expanded).toBe(false);
    expect(updateFabScroll(initial, -50, 500)).toEqual(initial);
  });

  it("expands near the top and when filtering leaves a non-scrollable list", () => {
    const collapsed = updateFabScroll(initial, 80, 500);
    expect(updateFabScroll(collapsed, 5, 500).expanded).toBe(true);
    expect(updateFabScroll(collapsed, 80, -20)).toEqual(initial);
  });
});

describe("Hiding chrome scroll direction", () => {
  const initial: ChromeScrollState = { anchor: 0, expanded: true, settleUntil: 0 };

  it("ignores the jump its own transition causes during a slow drag", () => {
    const hidden = updateChromeScroll(initial, 80, 500, 1_000, 260, 0);
    expect(hidden.expanded).toBe(false);
    // The header leaving moves the list up under the finger, so the offset falls back.
    const shifted = updateChromeScroll(hidden, 20, 500, 1_100, 260, 0);
    expect(shifted.expanded).toBe(false);
    // Once settled, continuing the same drag keeps the chrome hidden.
    expect(updateChromeScroll(shifted, 30, 500, 1_300, 260, 0).expanded).toBe(false);
  });

  it("keeps the chrome until the list is scrolled past the header", () => {
    const near = updateChromeScroll(initial, 80, 500, 1_000, 260, 150);
    expect(near.expanded).toBe(true);
    expect(updateChromeScroll(near, 180, 500, 1_050, 260, 150).expanded).toBe(false);
  });

  it("still shows the chrome on a real scroll up after it settles", () => {
    const hidden = updateChromeScroll(initial, 200, 500, 1_000, 260, 0);
    const settled = updateChromeScroll(hidden, 220, 500, 1_300, 260, 0);
    expect(updateChromeScroll(settled, 190, 500, 1_400, 260, 0).expanded).toBe(true);
  });
});
