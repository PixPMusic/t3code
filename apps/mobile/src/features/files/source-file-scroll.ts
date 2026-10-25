interface SourceLineList {
  scrollToIndex(options: { index: number; animated: boolean; viewPosition: number }): void;
  scrollToOffset(options: { offset: number; animated: boolean }): void;
}

export function createSourceLineScroll() {
  let pendingIndex: number | null = null;
  const scrollToLine = (list: SourceLineList | null, index: number) => {
    pendingIndex = null;
    list?.scrollToIndex({ index, animated: false, viewPosition: 0.3 });
  };

  return {
    scrollToLine,
    onScrollToIndexFailed(
      list: SourceLineList | null,
      info: { index: number; averageItemLength: number },
    ) {
      pendingIndex = info.index;
      // Wrapped rows have no fixed layout. Move their render window near the line,
      // then finish the jump when native measurements update the list.
      list?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
    },
    retry(list: SourceLineList | null) {
      if (pendingIndex !== null) scrollToLine(list, pendingIndex);
    },
    cancel() {
      pendingIndex = null;
    },
  };
}
