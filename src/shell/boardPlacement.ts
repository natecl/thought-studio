export type BoardPlacement = "pinned" | "project" | "recent" | null;

interface BoardPlacementCandidate {
  id: string;
  title: string;
  pinned?: boolean;
  recent?: boolean;
  project?: string;
}

export function boardPlacement(board: BoardPlacementCandidate): BoardPlacement {
  if (board.pinned) return "pinned";
  if (board.project) return "project";
  if (board.recent) return "recent";
  return null;
}
