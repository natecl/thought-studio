import { useCallback, useEffect, useReducer } from "react";
import type { BoardItem } from "./types";

const LEGACY_STORAGE_KEY = "thought-studio:board-items:v1";
const HISTORY_LIMIT = 100;

interface HistoryState {
  past: BoardItem[][];
  present: BoardItem[];
  future: BoardItem[][];
}

type HistoryAction =
  | { type: "commit"; next: BoardItem[] }
  | { type: "replace"; next: BoardItem[] }
  | { type: "checkpoint"; before: BoardItem[] }
  | { type: "undo" }
  | { type: "redo" };

function itemsMatch(left: BoardItem[], right: BoardItem[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit":
      if (itemsMatch(state.present, action.next)) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.next,
        future: [],
      };
    case "replace":
      return { ...state, present: action.next };
    case "checkpoint":
      if (itemsMatch(action.before, state.present)) return state;
      return {
        past: [...state.past, action.before].slice(-HISTORY_LIMIT),
        present: state.present,
        future: [],
      };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: state.future.slice(1),
      };
    }
  }
}

function storageKeyForBoard(boardId: string) {
  return boardId === "primary-board" ? LEGACY_STORAGE_KEY : `${LEGACY_STORAGE_KEY}:${boardId}`;
}

function loadItems(storageKey: string): BoardItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is BoardItem => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<BoardItem>;
      const hasBaseFields =
        typeof candidate.id === "string" &&
        typeof candidate.x === "number" &&
        typeof candidate.y === "number";
      if (!hasBaseFields || typeof candidate.text !== "string") return false;
      if (candidate.type === "text" || candidate.type === "note") return true;
      if (candidate.type === "source") {
        return (
          (candidate.sourceKind === "url" || candidate.sourceKind === "image" || candidate.sourceKind === "file") &&
          typeof candidate.url === "string" &&
          typeof candidate.origin === "string" &&
          typeof candidate.importedAt === "string" &&
          typeof candidate.width === "number" &&
          typeof candidate.height === "number"
        );
      }
      return (
        candidate.type === "frame" &&
        typeof candidate.width === "number" &&
        typeof candidate.height === "number" &&
        Array.isArray(candidate.childIds) &&
        candidate.childIds.every((id) => typeof id === "string")
      );
    });
  } catch {
    return [];
  }
}

export function useBoardHistory(boardId: string) {
  const storageKey = storageKeyForBoard(boardId);
  const [state, dispatch] = useReducer(historyReducer, undefined, (): HistoryState => ({
    past: [],
    present: loadItems(storageKey),
    future: [],
  }));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state.present));
  }, [state.present, storageKey]);

  const commit = useCallback((next: BoardItem[]) => dispatch({ type: "commit", next }), []);
  const replace = useCallback((next: BoardItem[]) => dispatch({ type: "replace", next }), []);
  const checkpoint = useCallback((before: BoardItem[]) => dispatch({ type: "checkpoint", before }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return {
    items: state.present,
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
