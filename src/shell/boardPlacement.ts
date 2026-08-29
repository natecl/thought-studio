export type BoardPlacement = "pinned" | "project" | "recent" | null;

export interface BoardSummary {
  id: string;
  title: string;
  pinned?: boolean;
  recent?: boolean;
  project?: string;
}

export function createRecentBoardSummary(id: string, title: string): BoardSummary {
  return { id, title, recent: true };
}

export function boardPlacement(board: BoardSummary): BoardPlacement {
  if (board.pinned) return "pinned";
  if (board.project) return "project";
  if (board.recent) return "recent";
  return null;
}
