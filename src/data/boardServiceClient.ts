import type { BoardContext, BoardItem, BoardRecord, BoardSummary } from "../domain/types";

const DEFAULT_WORKSPACE_ID = "personal";

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}

export class BoardApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BoardApiError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try { payload = await response.json() as ApiErrorPayload; } catch { /* use the status fallback */ }
    throw new BoardApiError(
      payload.error?.message || `Board service request failed with status ${response.status}`,
      payload.error?.code || "request_failed",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function listServiceBoards(workspaceId = DEFAULT_WORKSPACE_ID) {
  return requestJson<BoardSummary[]>(`/api/boards?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function createServiceBoard(input: {
  boardId?: string;
  workspaceId?: string;
  projectId?: string;
  title: string;
  idempotencyKey: string;
}) {
  return requestJson<BoardRecord>("/api/boards", {
    method: "POST",
    body: JSON.stringify({ workspaceId: DEFAULT_WORKSPACE_ID, ...input }),
  });
}

export function setServiceBoardArchived(input: {
  boardId: string;
  archived: boolean;
  idempotencyKey: string;
  workspaceId?: string;
}) {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  return requestJson<BoardRecord>(
    `/api/boards/${encodeURIComponent(input.boardId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ archived: input.archived, idempotencyKey: input.idempotencyKey }),
    },
  );
}

export function deleteServiceBoard(boardId: string, workspaceId = DEFAULT_WORKSPACE_ID) {
  return requestJson<{ deleted: BoardSummary }>(
    `/api/boards/${encodeURIComponent(boardId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
}

export function getServiceBoardContext(boardId: string, workspaceId = DEFAULT_WORKSPACE_ID) {
  return requestJson<BoardContext>(
    `/api/boards/${encodeURIComponent(boardId)}/context?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
}

export function synchronizeServiceCanvas(input: {
  boardId: string;
  expectedVersion: number;
  idempotencyKey: string;
  items: BoardItem[];
  workspaceId?: string;
}) {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
  return requestJson<BoardRecord>(
    `/api/boards/${encodeURIComponent(input.boardId)}/canvas?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        items: input.items,
      }),
    },
  );
}
