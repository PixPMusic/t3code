import { expect, it } from "vite-plus/test";

import { createSourceLineScroll } from "./source-file-scroll";

function setup() {
  let highestMeasuredIndex = 79;
  let visibleIndex = 0;
  let requestedOffset: number | null = null;
  let mounted = true;
  const list = {
    scrollToIndex({ index }: { index: number }) {
      if (index > highestMeasuredIndex) {
        // VirtualizedList requires this recovery path for unmeasured variable-height rows.
        if (!scroll.onScrollToIndexFailed) {
          throw new Error("scrollToIndex requires getItemLayout or onScrollToIndexFailed");
        }
        scroll.onScrollToIndexFailed(list, { index, averageItemLength: 24 });
        return;
      }
      visibleIndex = index;
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
      highestMeasuredIndex = index;
      scroll.retry(mounted ? list : null);
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
