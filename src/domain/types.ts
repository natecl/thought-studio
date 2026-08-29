export type BoardObjectType = "text" | "note";
export type BoardSourceKind = "url" | "image" | "file";
export type BoardItemType = BoardObjectType | "source" | "connection" | "frame" | "proposal";
export type ParticipantKind = "human" | "agent" | "import" | "system";
export type BoardCapability = "board:create" | "board:read" | "board:propose" | "board:write" | "proposal:review";

export interface ParticipantRef {
  id: string;
  kind: ParticipantKind;
  name: string;
}

export interface BoardPermissionGrant {
  workspaceId: string;
  capabilities: BoardCapability[];
  boardId?: string;
  frameId?: string;
}

export interface BoardPrincipal {
  participant: ParticipantRef;
  grants: BoardPermissionGrant[];
}

export interface AgentSourceReference {
  id: string;
  title: string;
  origin: string;
  url: string;
  sourceKind: BoardSourceKind;
  fileName?: string;
}

export interface BoardEntityBase {
  id: string;
  x: number;
  y: number;
  text: string;
  createdBy?: ParticipantRef;
  createdAt?: string;
  updatedAt?: string;
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

type AttributionFields = "createdBy" | "createdAt" | "updatedAt" | "authoredBy" | "authorName";

export interface CreateObjectOperation {
  operationId: string;
  type: "object.create";
  object: Omit<BoardObject, AttributionFields>;
}

export interface CreateSourceOperation {
  operationId: string;
  type: "source.create";
  source: Omit<BoardSource, "createdBy" | "createdAt" | "updatedAt">;
}

export interface CreateConnectionOperation {
  operationId: string;
  type: "connection.create";
  connection: Omit<BoardConnection, "createdBy" | "createdAt" | "updatedAt">;
}

export interface CreateFrameOperation {
  operationId: string;
  type: "frame.create";
  frame: Omit<BoardFrame, "createdBy" | "createdAt" | "updatedAt">;
}

export interface UpdateTextOperation {
  operationId: string;
  type: "entity.update_text";
  entityId: string;
  text: string;
}

export interface MoveEntitiesOperation {
  operationId: string;
  type: "entities.move";
  entityIds: string[];
  delta: { x: number; y: number };
}

export interface DeleteEntitiesOperation {
  operationId: string;
  type: "entities.delete";
  entityIds: string[];
}

export interface SetFrameChildrenOperation {
  operationId: string;
  type: "frame.set_children";
  frameId: string;
  childIds: string[];
}

export type BoardOperation =
  | CreateObjectOperation
  | CreateSourceOperation
  | CreateConnectionOperation
  | CreateFrameOperation
  | UpdateTextOperation
  | MoveEntitiesOperation
  | DeleteEntitiesOperation
  | SetFrameChildrenOperation;

export type BoardScope =
  | { type: "board"; boardId: string }
  | { type: "frame"; boardId: string; frameId: string };

export type BoardProposalStatus = "pending" | "accepted" | "rejected";

export interface BoardChangeProposal {
  id: string;
  boardId: string;
  baseContentVersion: number;
  scope: BoardScope;
  prompt?: string;
  operations: BoardOperation[];
  status: BoardProposalStatus;
  proposedBy: ParticipantRef;
  createdAt: string;
  reviewedBy?: ParticipantRef;
  reviewedAt?: string;
  idempotencyKey: string;
}

export type BoardActivityKind =
  | "board.created"
  | "canvas.synchronized"
  | "changes.proposed"
  | "changes.applied"
  | "proposal.accepted"
  | "proposal.rejected";

export interface BoardActivity {
  id: string;
  kind: BoardActivityKind;
  actor: ParticipantRef;
  scope: BoardScope;
  createdAt: string;
  idempotencyKey: string;
  proposalId?: string;
  operationIds: string[];
  summary: string;
}

export interface BoardRecord {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  createdBy: ParticipantRef;
  createdAt: string;
  updatedAt: string;
  version: number;
  contentVersion: number;
  items: BoardItem[];
  proposals: BoardChangeProposal[];
  history: BoardActivity[];
}

export interface BoardSummary {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  createdBy: ParticipantRef;
  createdAt: string;
  updatedAt: string;
  version: number;
  contentVersion: number;
}

export interface BoardContext {
  board: BoardSummary;
  scope: BoardScope;
  items: BoardItem[];
  pendingProposals: BoardChangeProposal[];
}
