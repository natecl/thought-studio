export type BoardObjectType = "text" | "note";
export type BoardSourceKind = "url" | "image" | "file";
export type BoardItemType = BoardObjectType | "source" | "connection" | "frame" | "proposal";

export interface AgentSourceReference {
  id: string;
  title: string;
  origin: string;
  url: string;
  sourceKind: BoardSourceKind;
  fileName?: string;
}

interface BoardEntityBase {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface BoardObject extends BoardEntityBase {
  type: BoardObjectType;
  sourceId?: string;
  sourceLinkKind?: "note" | "quote";
  sourceTitle?: string;
  sourceOrigin?: string;
  sourceUrl?: string;
  sourceKind?: BoardSourceKind;
  sourceFileName?: string;
  authoredBy?: "agent";
  authorName?: string;
  proposalPrompt?: string;
  agentScopeIds?: string[];
  agentScopeLabels?: string[];
  agentSources?: AgentSourceReference[];
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

export interface BoardConnection extends BoardEntityBase {
  type: "connection";
  fromId: string;
  toId: string;
}

export interface BoardFrame extends BoardEntityBase {
  type: "frame";
  width: number;
  height: number;
  childIds: string[];
}

export interface BoardProposal extends BoardEntityBase {
  type: "proposal";
  prompt: string;
  agentName: string;
  scopeIds: string[];
  scopeLabels: string[];
  sources: AgentSourceReference[];
  createdAt: string;
  width: number;
  height: number;
}

export type BoardItem = BoardObject | BoardSource | BoardConnection | BoardFrame | BoardProposal;

export interface Camera {
  x: number;
  y: number;
  scale: number;
}
