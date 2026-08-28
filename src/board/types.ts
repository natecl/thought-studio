export type BoardItemType = "text" | "note";

export interface BoardItem {
  id: string;
  type: BoardItemType;
  x: number;
  y: number;
  text: string;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
