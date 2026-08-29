import { BoardDomainError } from "./errors";
import type { BoardRecord } from "./types";

export interface BoardRepository {
  list(workspaceId?: string): Promise<BoardRecord[]>;
  get(boardId: string): Promise<BoardRecord | null>;
  save(board: BoardRecord, expectedVersion: number | null): Promise<void>;
}

function cloneBoard(board: BoardRecord) {
  return structuredClone(board);
}

export class InMemoryBoardRepository implements BoardRepository {
  private readonly boards = new Map<string, BoardRecord>();

  constructor(initialBoards: BoardRecord[] = []) {
    initialBoards.forEach((board) => this.boards.set(board.id, cloneBoard(board)));
  }

  async list(workspaceId?: string) {
    return [...this.boards.values()]
      .filter((board) => !workspaceId || board.workspaceId === workspaceId)
      .map(cloneBoard);
  }

  async get(boardId: string) {
    const board = this.boards.get(boardId);
    return board ? cloneBoard(board) : null;
  }

  async save(board: BoardRecord, expectedVersion: number | null) {
    const current = this.boards.get(board.id);
    if (expectedVersion === null) {
      if (current) throw new BoardDomainError(`Board "${board.id}" already exists`, "version_conflict");
    } else if (!current || current.version !== expectedVersion) {
      throw new BoardDomainError(`Board "${board.id}" changed before this operation could be saved`, "version_conflict");
    }
    this.boards.set(board.id, cloneBoard(board));
  }
}
