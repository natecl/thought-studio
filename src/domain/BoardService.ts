import { BoardDomainError, invariant } from "./errors";
import { applyBoardOperations, validateOperationsForScope } from "./operations";
import type { BoardRepository } from "./repository";
import { parseBoardItems } from "./validation";
import type {
  BoardActivity,
  BoardCapability,
  BoardChangeProposal,
  BoardContext,
  BoardItem,
  BoardOperation,
  BoardPrincipal,
  BoardRecord,
  BoardScope,
  BoardSummary,
  ParticipantRef,
} from "./types";

export interface CreateBoardCommand {
  boardId?: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  idempotencyKey: string;
}

export interface ReadBoardCommand {
  boardId: string;
  frameId?: string;
}

export interface ProposeChangesCommand {
  boardId: string;
  expectedVersion: number;
  idempotencyKey: string;
  scope?: BoardScope;
  prompt?: string;
  operations: BoardOperation[];
}

export interface ApplyChangesCommand extends Omit<ProposeChangesCommand, "prompt"> {}

export interface SynchronizeCanvasCommand {
  boardId: string;
  expectedVersion: number;
  idempotencyKey: string;
  items: BoardItem[];
}

export interface ReviewProposalCommand {
  boardId: string;
  proposalId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface SetBoardArchivedCommand {
  boardId: string;
  archived: boolean;
  idempotencyKey: string;
}

export interface DeleteBoardCommand {
  boardId: string;
}

interface BoardServiceDependencies {
  createId: () => string;
  now: () => string;
}

const DEFAULT_DEPENDENCIES: BoardServiceDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

function summarize(board: BoardRecord): BoardSummary {
  const { items: _items, proposals: _proposals, history: _history, ...summary } = board;
  return summary;
}

function grantAllows(principal: BoardPrincipal, capability: BoardCapability, workspaceId: string, scope?: BoardScope) {
  return principal.grants.some((grant) => {
    if (grant.workspaceId !== workspaceId || !grant.capabilities.includes(capability)) return false;
    if (!scope) return !grant.boardId && !grant.frameId;
    if (grant.boardId && grant.boardId !== scope.boardId) return false;
    if (grant.frameId && (scope.type !== "frame" || grant.frameId !== scope.frameId)) return false;
    return true;
  });
}

function requireCapability(principal: BoardPrincipal, capability: BoardCapability, workspaceId: string, scope?: BoardScope) {
  if (!grantAllows(principal, capability, workspaceId, scope)) {
    throw new BoardDomainError(`${principal.participant.name} does not have ${capability} permission for this scope`, "permission_denied");
  }
}

function requireExpectedVersion(board: BoardRecord, expectedVersion: number) {
  if (board.version !== expectedVersion) {
    throw new BoardDomainError(`Expected Board version ${expectedVersion}, but version ${board.version} is current`, "version_conflict");
  }
}

function requireScope(board: BoardRecord, requestedScope?: BoardScope): BoardScope {
  const scope = requestedScope ?? { type: "board", boardId: board.id };
  invariant(scope.boardId === board.id, "The requested scope belongs to a different Board");
  if (scope.type === "frame") {
    invariant(board.items.some((item) => item.id === scope.frameId && item.type === "frame"), `Frame "${scope.frameId}" does not exist`);
  }
  return scope;
}

function activity(
  dependencies: BoardServiceDependencies,
  input: Omit<BoardActivity, "id" | "createdAt">,
): BoardActivity {
  return { ...input, id: dependencies.createId(), createdAt: dependencies.now() };
}

export class BoardService {
  private readonly dependencies: BoardServiceDependencies;

  constructor(
    private readonly repository: BoardRepository,
    dependencies: Partial<BoardServiceDependencies> = {},
  ) {
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  }

  async createBoard(principal: BoardPrincipal, command: CreateBoardCommand) {
    invariant(command.workspaceId.length > 0, "workspaceId is required");
    invariant(command.title.trim().length > 0, "Board title is required");
    invariant(command.idempotencyKey.length > 0, "idempotencyKey is required");
    requireCapability(principal, "board:create", command.workspaceId);

    const prior = (await this.repository.list(command.workspaceId))
      .find((board) => board.history.some((entry) => entry.kind === "board.created" &&
        entry.idempotencyKey === command.idempotencyKey && entry.actor.id === principal.participant.id));
    if (prior) return prior;

    if (command.boardId) {
      invariant(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(command.boardId), "boardId contains unsupported characters");
    }
    const boardId = command.boardId ?? this.dependencies.createId();
    const timestamp = this.dependencies.now();
    const scope: BoardScope = { type: "board", boardId };
    const created: BoardRecord = {
      id: boardId,
      workspaceId: command.workspaceId,
      projectId: command.projectId,
      title: command.title.trim(),
      createdBy: principal.participant,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      contentVersion: 0,
      items: [],
      proposals: [],
      history: [activity(this.dependencies, {
        kind: "board.created",
        actor: principal.participant,
        scope,
        idempotencyKey: command.idempotencyKey,
        operationIds: [],
        summary: `Created Board "${command.title.trim()}"`,
      })],
    };
    await this.repository.save(created, null);
    return created;
  }

  async listBoards(principal: BoardPrincipal, workspaceId: string) {
    requireCapability(principal, "board:read", workspaceId);
    return (await this.repository.list(workspaceId)).map(summarize);
  }

  async getBoard(principal: BoardPrincipal, boardId: string) {
    const board = await this.requireBoard(boardId);
    requireCapability(principal, "board:read", board.workspaceId, { type: "board", boardId });
    return board;
  }

  async getContext(principal: BoardPrincipal, command: ReadBoardCommand): Promise<BoardContext> {
    const board = await this.requireBoard(command.boardId);
    const scope = requireScope(board, command.frameId
      ? { type: "frame", boardId: board.id, frameId: command.frameId }
      : { type: "board", boardId: board.id });
    requireCapability(principal, "board:read", board.workspaceId, scope);

    if (scope.type === "board") {
      return {
        board: summarize(board),
        scope,
        items: board.items,
        pendingProposals: board.proposals.filter((proposal) => proposal.status === "pending"),
      };
    }

    const frame = board.items.find((item) => item.id === scope.frameId && item.type === "frame");
    invariant(frame && frame.type === "frame", `Frame "${scope.frameId}" does not exist`);
    const includedIds = new Set([frame.id, ...frame.childIds]);
    const items = board.items.filter((item) => includedIds.has(item.id) ||
      (item.type === "connection" && includedIds.has(item.fromId) && includedIds.has(item.toId)));
    return {
      board: summarize(board),
      scope,
      items,
      pendingProposals: board.proposals.filter((proposal) => proposal.status === "pending" &&
        proposal.scope.type === "frame" && proposal.scope.frameId === scope.frameId),
    };
  }

  async setBoardArchived(principal: BoardPrincipal, command: SetBoardArchivedCommand) {
    const board = await this.requireBoard(command.boardId);
    const scope: BoardScope = { type: "board", boardId: board.id };
    requireCapability(principal, "board:write", board.workspaceId, scope);
    invariant(command.idempotencyKey.length > 0, "idempotencyKey is required");
    const kind = command.archived ? "board.archived" : "board.restored";
    const prior = board.history.find((entry) => entry.kind === kind &&
      entry.idempotencyKey === command.idempotencyKey && entry.actor.id === principal.participant.id);
    if (prior || Boolean(board.archivedAt) === command.archived) return board;

    const timestamp = this.dependencies.now();
    const next: BoardRecord = {
      ...board,
      version: board.version + 1,
      updatedAt: timestamp,
      archivedAt: command.archived ? timestamp : undefined,
      history: [...board.history, activity(this.dependencies, {
        kind,
        actor: principal.participant,
        scope,
        idempotencyKey: command.idempotencyKey,
        operationIds: [],
        summary: `${command.archived ? "Archived" : "Restored"} Board "${board.title}"`,
      })],
    };
    await this.repository.save(next, board.version);
    return next;
  }

  async deleteBoard(principal: BoardPrincipal, command: DeleteBoardCommand) {
    const board = await this.requireBoard(command.boardId);
    requireCapability(principal, "board:write", board.workspaceId, { type: "board", boardId: board.id });
    await this.repository.delete(board.id, board.version);
    return summarize(board);
  }

  async proposeChanges(principal: BoardPrincipal, command: ProposeChangesCommand) {
    const board = await this.requireBoard(command.boardId);
    const scope = requireScope(board, command.scope);
    requireCapability(principal, "board:propose", board.workspaceId, scope);
    const existing = board.proposals.find((proposal) => proposal.idempotencyKey === command.idempotencyKey &&
      proposal.proposedBy.id === principal.participant.id);
    if (existing) return existing;
    requireExpectedVersion(board, command.expectedVersion);
    validateOperationsForScope(board.items, command.operations, scope);
    applyBoardOperations(board.items, command.operations, principal.participant, this.dependencies.now());

    const proposal: BoardChangeProposal = {
      id: this.dependencies.createId(),
      boardId: board.id,
      baseContentVersion: board.contentVersion,
      scope,
      prompt: command.prompt?.trim() || undefined,
      operations: structuredClone(command.operations),
      status: "pending",
      proposedBy: principal.participant,
      createdAt: this.dependencies.now(),
      idempotencyKey: command.idempotencyKey,
    };
    const next: BoardRecord = {
      ...board,
      version: board.version + 1,
      updatedAt: this.dependencies.now(),
      proposals: [...board.proposals, proposal],
      history: [...board.history, activity(this.dependencies, {
        kind: "changes.proposed",
        actor: principal.participant,
        scope,
        idempotencyKey: command.idempotencyKey,
        proposalId: proposal.id,
        operationIds: command.operations.map((operation) => operation.operationId),
        summary: `Proposed ${command.operations.length} Board ${command.operations.length === 1 ? "operation" : "operations"}`,
      })],
    };
    await this.repository.save(next, board.version);
    return proposal;
  }

  async applyChanges(principal: BoardPrincipal, command: ApplyChangesCommand) {
    const board = await this.requireBoard(command.boardId);
    const scope = requireScope(board, command.scope);
    requireCapability(principal, "board:write", board.workspaceId, scope);
    if (board.history.some((entry) => entry.kind === "changes.applied" && entry.idempotencyKey === command.idempotencyKey &&
      entry.actor.id === principal.participant.id)) return board;
    requireExpectedVersion(board, command.expectedVersion);
    validateOperationsForScope(board.items, command.operations, scope);
    const timestamp = this.dependencies.now();
    const next: BoardRecord = {
      ...board,
      version: board.version + 1,
      contentVersion: board.contentVersion + 1,
      updatedAt: timestamp,
      items: applyBoardOperations(board.items, command.operations, principal.participant, timestamp),
      history: [...board.history, activity(this.dependencies, {
        kind: "changes.applied",
        actor: principal.participant,
        scope,
        idempotencyKey: command.idempotencyKey,
        operationIds: command.operations.map((operation) => operation.operationId),
        summary: `Applied ${command.operations.length} Board ${command.operations.length === 1 ? "operation" : "operations"}`,
      })],
    };
    await this.repository.save(next, board.version);
    return next;
  }

  async synchronizeCanvas(principal: BoardPrincipal, command: SynchronizeCanvasCommand) {
    const board = await this.requireBoard(command.boardId);
    const scope: BoardScope = { type: "board", boardId: board.id };
    requireCapability(principal, "board:write", board.workspaceId, scope);
    invariant(command.idempotencyKey.length > 0, "idempotencyKey is required");
    const prior = board.history.find((entry) => entry.kind === "canvas.synchronized" &&
      entry.idempotencyKey === command.idempotencyKey && entry.actor.id === principal.participant.id);
    if (prior) return board;

    const desiredItems = parseBoardItems(command.items);
    if (JSON.stringify(board.items) === JSON.stringify(desiredItems)) return board;
    requireExpectedVersion(board, command.expectedVersion);

    const timestamp = this.dependencies.now();
    const existingItems = new Map(board.items.map((item) => [item.id, item]));
    const items = desiredItems.map((item) => {
      const existing = existingItems.get(item.id);
      const unchanged = existing && JSON.stringify(existing) === JSON.stringify(item);
      return {
        ...item,
        createdBy: existing?.createdBy ?? item.createdBy ?? principal.participant,
        createdAt: existing?.createdAt ?? item.createdAt ?? timestamp,
        updatedAt: unchanged ? existing.updatedAt : timestamp,
      } as BoardItem;
    });
    parseBoardItems(items);

    const next: BoardRecord = {
      ...board,
      version: board.version + 1,
      contentVersion: board.contentVersion + 1,
      updatedAt: timestamp,
      items,
      history: [...board.history, activity(this.dependencies, {
        kind: "canvas.synchronized",
        actor: principal.participant,
        scope,
        idempotencyKey: command.idempotencyKey,
        operationIds: [],
        summary: `Synchronized ${items.length} visible Board ${items.length === 1 ? "item" : "items"}`,
      })],
    };
    await this.repository.save(next, board.version);
    return next;
  }

  async acceptProposal(principal: BoardPrincipal, command: ReviewProposalCommand) {
    return this.reviewProposal(principal, command, "accepted");
  }

  async rejectProposal(principal: BoardPrincipal, command: ReviewProposalCommand) {
    return this.reviewProposal(principal, command, "rejected");
  }

  private async reviewProposal(
    principal: BoardPrincipal,
    command: ReviewProposalCommand,
    decision: "accepted" | "rejected",
  ) {
    const board = await this.requireBoard(command.boardId);
    const proposal = board.proposals.find((candidate) => candidate.id === command.proposalId);
    if (!proposal) throw new BoardDomainError(`Proposal "${command.proposalId}" does not exist`, "not_found");
    requireCapability(principal, "proposal:review", board.workspaceId, proposal.scope);
    if (board.history.some((entry) => entry.idempotencyKey === command.idempotencyKey && entry.actor.id === principal.participant.id &&
      entry.kind === (decision === "accepted" ? "proposal.accepted" : "proposal.rejected"))) return board;
    requireExpectedVersion(board, command.expectedVersion);
    invariant(proposal.status === "pending", `Proposal "${command.proposalId}" has already been reviewed`);
    if (decision === "accepted" && proposal.baseContentVersion !== board.contentVersion) {
      throw new BoardDomainError("Board content changed after this proposal was created; review it against the current Board before applying", "proposal_conflict");
    }

    const timestamp = this.dependencies.now();
    const reviewedProposal: BoardChangeProposal = {
      ...proposal,
      status: decision,
      reviewedBy: principal.participant,
      reviewedAt: timestamp,
    };
    const items = decision === "accepted"
      ? applyBoardOperations(board.items, proposal.operations, proposal.proposedBy, timestamp)
      : board.items;
    const next: BoardRecord = {
      ...board,
      version: board.version + 1,
      contentVersion: board.contentVersion + (decision === "accepted" ? 1 : 0),
      updatedAt: timestamp,
      items,
      proposals: board.proposals.map((candidate) => candidate.id === proposal.id ? reviewedProposal : candidate),
      history: [...board.history, activity(this.dependencies, {
        kind: decision === "accepted" ? "proposal.accepted" : "proposal.rejected",
        actor: principal.participant,
        scope: proposal.scope,
        idempotencyKey: command.idempotencyKey,
        proposalId: proposal.id,
        operationIds: proposal.operations.map((operation) => operation.operationId),
        summary: `${decision === "accepted" ? "Accepted" : "Rejected"} proposal from ${proposal.proposedBy.name}`,
      })],
    };
    await this.repository.save(next, board.version);
    return next;
  }

  private async requireBoard(boardId: string) {
    const board = await this.repository.get(boardId);
    if (!board) throw new BoardDomainError(`Board "${boardId}" does not exist`, "not_found");
    return board;
  }
}
