export type BoardPlacement = "pinned" | "project" | "recent" | "archived" | null;

export interface BoardSummary {
  id: string;
  title: string;
  pinned?: boolean;
  recent?: boolean;
  project?: string;
  archived?: boolean;
  serviceVersion?: number;
}

export function createRecentBoardSummary(id: string, title: string): BoardSummary {
  return { id, title, recent: true };
}

export function boardPlacement(board: BoardSummary): BoardPlacement {
  if (board.archived) return "archived";
  if (board.pinned) return "pinned";
  if (board.project) return "project";
  if (board.recent) return "recent";
  return null;
}
