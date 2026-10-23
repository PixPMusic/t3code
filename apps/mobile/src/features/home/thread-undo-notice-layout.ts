import { createContext } from "react";

export const ThreadUndoNoticeHeightContext = createContext<((height: number) => void) | null>(null);
