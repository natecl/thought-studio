export type BoardObjectType = "text" | "note";
export type BoardItemType = BoardObjectType | "frame";

interface BoardEntityBase {
  id: string;
  x: number;
  y: number;
}

export interface BoardObject extends BoardEntityBase {
  type: BoardObjectType;
  text: string;
}

export interface BoardFrame extends BoardEntityBase {
  type: "frame";
  text: string;
  width: number;
  height: number;
  childIds: string[];
}

export type BoardItem = BoardObject | BoardFrame;

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
