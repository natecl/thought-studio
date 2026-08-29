export type BoardObjectType = "text" | "note";
export type BoardSourceKind = "url" | "image" | "file";
export type BoardItemType = BoardObjectType | "source" | "frame";

interface BoardEntityBase {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface BoardObject extends BoardEntityBase {
  type: BoardObjectType;
}

export interface BoardSource extends BoardEntityBase {
  type: "source";
  sourceKind: BoardSourceKind;
  url: string;
  origin: string;
  importedAt: string;
  width: number;
  height: number;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  previewDataUrl?: string;
}

export interface BoardFrame extends BoardEntityBase {
  type: "frame";
  width: number;
  height: number;
  childIds: string[];
}

export type BoardItem = BoardObject | BoardSource | BoardFrame;

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
