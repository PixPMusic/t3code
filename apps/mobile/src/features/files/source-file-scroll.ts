interface SourceLineList {
  readonly props: { readonly data?: { readonly length: number } | null };
  scrollToIndex(options: { index: number; animated: boolean; viewPosition: number }): void;
  scrollToOffset(options: { offset: number; animated: boolean }): void;
}

export function createSourceLineScroll() {
  let pendingIndex: number | null = null;
  let visibleItems: ReadonlyArray<{ readonly index?: number | null }> = [];
  let scrollOffset = 0;
  let viewportHeight = 0;
  let averageItemLength = 0;
  const target = (list: SourceLineList | null) => {
    if (
      pendingIndex !== null &&
      (pendingIndex < 0 || pendingIndex >= (list?.props.data?.length ?? 0))
    ) {
      pendingIndex = null;
    }
    return pendingIndex;
  };
  const scrollToLine = (list: SourceLineList | null, index: number) => {
    pendingIndex = index;
    if (target(list) === null) return;
    list?.scrollToIndex({ index, animated: false, viewPosition: 0.3 });
    if (visibleItems.some((item) => item.index === index)) pendingIndex = null;
  };
  const recoverFromViewport = (list: SourceLineList | null) => {
    const index = target(list);
    if (index === null) return;
    if (visibleItems.some((item) => item.index === index)) {
      pendingIndex = null;
      list?.scrollToIndex({ index, animated: false, viewPosition: 0.3 });
      return;
    }
    const first = visibleItems[0]?.index;
    const last = visibleItems.at(-1)?.index;
    if (first == null || last == null || last < first) return;
    // An accepted scroll can still use an estimate for an unmeasured row.
    // Correct from the actual viewport rather than repeating that same estimate.
    const rowHeight = viewportHeight > 0 ? viewportHeight / (last - first + 1) : averageItemLength;
    if (rowHeight <= 0) return;
    list?.scrollToOffset({
      offset: Math.max(0, scrollOffset + (index - first) * rowHeight),
      animated: false,
    });
  };

  return {
    scrollToLine,
    onScrollToIndexFailed(
      list: SourceLineList | null,
      info: { index: number; averageItemLength: number },
    ) {
      if (target(list) !== info.index) return;
      averageItemLength = info.averageItemLength;
      // Wrapped rows have no fixed layout. Move their render window near the line,
      // then finish the jump when native measurements update the list.
      list?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
    },
    retry(list: SourceLineList | null) {
      const index = target(list);
      if (index !== null) scrollToLine(list, index);
    },
    onScroll(offset: number, height: number, list: SourceLineList | null) {
      const moved = offset !== scrollOffset;
      scrollOffset = offset;
      viewportHeight = height;
      if (moved && pendingIndex !== null) {
        // RN updates viewability after our scroll handler, and skips its callback
        // while the viewport stays inside one tall row. Use the updated rows.
        queueMicrotask(() => recoverFromViewport(list));
      }
    },
    onViewableItemsChanged(
      list: SourceLineList | null,
      items: ReadonlyArray<{ readonly index?: number | null }>,
    ) {
      visibleItems = items;
      recoverFromViewport(list);
    },
    cancel() {
      pendingIndex = null;
      visibleItems = [];
      scrollOffset = 0;
      viewportHeight = 0;
      averageItemLength = 0;
    },
  };
}
