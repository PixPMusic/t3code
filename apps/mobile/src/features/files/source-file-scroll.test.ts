import { expect, it } from "vite-plus/test";

import { createSourceLineScroll } from "./source-file-scroll";

function setup() {
  let highestMeasuredIndex = 79;
  let visibleIndex = 0;
  let requestedOffset: number | null = null;
  let mounted = true;
  let lineCount = 1_203;
  let unmeasuredIndex: number | null = null;
  const list = {
    get props() {
      return { data: { length: lineCount } };
    },
    scrollToIndex({ index }: { index: number }) {
      if (index >= lineCount) throw new Error("scrollToIndex out of range");
      if (index > highestMeasuredIndex) {
        // VirtualizedList requires this recovery path for unmeasured variable-height rows.
        if (!scroll.onScrollToIndexFailed) {
          throw new Error("scrollToIndex requires getItemLayout or onScrollToIndexFailed");
        }
        scroll.onScrollToIndexFailed(list, { index, averageItemLength: 24 });
        return;
      }
      visibleIndex = index === unmeasuredIndex ? 100 : index;
    },
    scrollToOffset({ offset }: { offset: number }) {
      requestedOffset = offset;
    },
  };
  const scroll = createSourceLineScroll();
  return {
    scroll: {
      scrollToLine: (index: number) => scroll.scrollToLine(mounted ? list : null, index),
      cancel: scroll.cancel,
    },
    get visibleIndex() {
      return visibleIndex;
    },
    get requestedOffset() {
      return requestedOffset;
    },
    measureThrough(index: number) {
      highestMeasuredIndex = Math.max(highestMeasuredIndex, index);
      if (unmeasuredIndex !== null && index >= unmeasuredIndex) unmeasuredIndex = null;
      scroll.retry(mounted ? list : null);
    },
    acceptApproximationFor(index: number) {
      highestMeasuredIndex = index + 100;
      unmeasuredIndex = index;
    },
    replaceDocument(count: number) {
      lineCount = count;
    },
    reportViewable(offset: number, height: number, indices: readonly number[]) {
      visibleIndex = indices[0] ?? visibleIndex;
      highestMeasuredIndex = Math.max(highestMeasuredIndex, ...indices);
      if (unmeasuredIndex !== null && indices.includes(unmeasuredIndex)) unmeasuredIndex = null;
      scroll.onScroll(offset, height);
      scroll.onViewableItemsChanged(
        mounted ? list : null,
        indices.map((index) => ({ index })),
      );
    },
    unmount() {
      mounted = false;
      scroll.cancel();
    },
  };
}

it("opens a distant wrapped line after the list measures the destination", () => {
  const state = setup();

  expect(() => state.scroll.scrollToLine(899)).not.toThrow();
  expect(state.requestedOffset).toBe(899 * 24);
  state.measureThrough(950);
  expect(state.visibleIndex).toBe(899);
});

it("keeps recovering when the estimated jump needs another measurement pass", () => {
  const state = setup();

  state.scroll.scrollToLine(899);
  state.measureThrough(850);
  expect(state.visibleIndex).toBe(0);
  state.measureThrough(950);
  expect(state.visibleIndex).toBe(899);
});

it("cancels a pending line jump when changing files", () => {
  const state = setup();

  state.scroll.scrollToLine(899);
  state.scroll.cancel();
  state.measureThrough(950);
  expect(state.visibleIndex).toBe(0);

  state.scroll.scrollToLine(4);
  state.measureThrough(950);
  expect(state.visibleIndex).toBe(4);
});

it("does not scroll after the source list unmounts", () => {
  const state = setup();

  state.scroll.scrollToLine(899);
  state.unmount();
  expect(() => state.measureThrough(950)).not.toThrow();
  expect(state.visibleIndex).toBe(0);
});

it("keeps an accepted approximate jump pending until the target is reached", () => {
  const state = setup();
  state.acceptApproximationFor(899);

  state.scroll.scrollToLine(899);
  expect(state.visibleIndex).toBe(100);
  state.measureThrough(950);
  expect(state.visibleIndex).toBe(899);
});

it("rejects a stale jump when replacement data arrives before cleanup", () => {
  const state = setup();

  state.scroll.scrollToLine(899);
  state.replaceDocument(12);
  expect(() => state.measureThrough(950)).not.toThrow();
  expect(state.visibleIndex).toBe(0);
});

it.each([
  { first: 100, offset: 2_400, direction: "before" },
  { first: 1_000, offset: 24_000, direction: "after" },
])("corrects an approximate jump that lands $direction the target", ({ first, offset }) => {
  const state = setup();
  state.acceptApproximationFor(899);
  state.scroll.scrollToLine(899);

  state.reportViewable(
    offset,
    240,
    Array.from({ length: 10 }, (_, index) => first + index),
  );
  if (first < 899) expect(state.requestedOffset).toBeGreaterThan(offset);
  else expect(state.requestedOffset).toBeLessThan(offset);

  state.measureThrough(950);
  expect(state.visibleIndex).toBe(899);
});

it("stops recovering after the target becomes visible", () => {
  const state = setup();
  state.acceptApproximationFor(899);
  state.scroll.scrollToLine(899);

  state.reportViewable(21_576, 240, [899, 900, 901]);
  expect(state.visibleIndex).toBe(899);

  state.reportViewable(480, 240, [20, 21, 22]);
  state.measureThrough(1_100);
  expect(state.visibleIndex).toBe(20);
});

it("finishes an already visible target without waiting for another viewability event", () => {
  const state = setup();
  state.reportViewable(0, 240, [0, 1, 2, 3, 4]);

  state.scroll.scrollToLine(4);
  state.reportViewable(480, 240, [20, 21, 22]);
  state.measureThrough(100);
  expect(state.visibleIndex).toBe(20);
});
