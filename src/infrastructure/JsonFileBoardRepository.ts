import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { BoardDomainError } from "../domain/errors";
import type { BoardRepository } from "../domain/repository";
import type { BoardRecord } from "../domain/types";

interface BoardStoreFile {
  schemaVersion: 1;
  boards: BoardRecord[];
}

function cloneBoard(board: BoardRecord) {
  return structuredClone(board);
}

function isBoardRecord(value: unknown): value is BoardRecord {
  if (!value || typeof value !== "object") return false;
  const board = value as Partial<BoardRecord>;
  return typeof board.id === "string" &&
    typeof board.workspaceId === "string" &&
    typeof board.title === "string" &&
    typeof board.version === "number" &&
    typeof board.contentVersion === "number" &&
    Array.isArray(board.items) &&
    Array.isArray(board.proposals) &&
    Array.isArray(board.history);
}

export class JsonFileBoardRepository implements BoardRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async list(workspaceId?: string) {
    await this.writeQueue;
    const store = await this.readStore();
    return store.boards
      .filter((board) => !workspaceId || board.workspaceId === workspaceId)
      .map(cloneBoard);
  }

  async get(boardId: string) {
    await this.writeQueue;
    const board = (await this.readStore()).boards.find((candidate) => candidate.id === boardId);
    return board ? cloneBoard(board) : null;
  }

  async save(board: BoardRecord, expectedVersion: number | null) {
    const write = this.writeQueue.then(() => this.withFileLock(() => this.saveLocked(board, expectedVersion)));
    this.writeQueue = write.catch(() => undefined);
    return write;
  }

  async delete(boardId: string, expectedVersion: number) {
    const write = this.writeQueue.then(() => this.withFileLock(() => this.deleteLocked(boardId, expectedVersion)));
    this.writeQueue = write.catch(() => undefined);
    return write;
  }

  private async saveLocked(board: BoardRecord, expectedVersion: number | null) {
    const store = await this.readStore();
    const index = store.boards.findIndex((candidate) => candidate.id === board.id);
    const current = store.boards[index];
    if (expectedVersion === null) {
      if (current) throw new BoardDomainError(`Board "${board.id}" already exists`, "version_conflict");
      store.boards.push(cloneBoard(board));
    } else {
      if (!current || current.version !== expectedVersion) {
        throw new BoardDomainError(`Board "${board.id}" changed before this operation could be saved`, "version_conflict");
      }
      store.boards[index] = cloneBoard(board);
    }
    await this.writeStore(store);
  }

  private async deleteLocked(boardId: string, expectedVersion: number) {
    const store = await this.readStore();
    const index = store.boards.findIndex((candidate) => candidate.id === boardId);
    const current = store.boards[index];
    if (!current || current.version !== expectedVersion) {
      throw new BoardDomainError(`Board "${boardId}" changed before this operation could be saved`, "version_conflict");
    }
    store.boards.splice(index, 1);
    await this.writeStore(store);
  }

  private async withFileLock<T>(task: () => Promise<T>): Promise<T> {
    const lockPath = `${this.filePath}.lock`;
    await mkdir(dirname(this.filePath), { recursive: true });
    let handle;
    for (let attempt = 0; attempt < 1_500; attempt += 1) {
      try {
        handle = await open(lockPath, "wx");
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (attempt > 0 && attempt % 100 === 0) {
          const lockAge = Date.now() - await stat(lockPath).then((details) => details.mtimeMs).catch(() => Date.now());
          if (lockAge > 10_000) await unlink(lockPath).catch(() => undefined);
        }
        await delay(10);
      }
    }
    if (!handle) throw new BoardDomainError(`Board store at ${this.filePath} is busy`, "version_conflict");
    try {
      return await task();
    } finally {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }

  private async readStore(): Promise<BoardStoreFile> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object") throw new Error("Root value is not an object");
      const candidate = parsed as Partial<BoardStoreFile>;
      if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.boards) || !candidate.boards.every(isBoardRecord)) {
        throw new Error("Unsupported or invalid Board store schema");
      }
      return { schemaVersion: 1, boards: candidate.boards };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, boards: [] };
      if (error instanceof SyntaxError || error instanceof Error &&
        (error.message.includes("Board store") || error.message.includes("Root value"))) {
        throw new BoardDomainError(`Cannot read Board store at ${this.filePath}: ${error.message}`, "validation_failed");
      }
      throw error;
    }
  }

  private async writeStore(store: BoardStoreFile) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}
