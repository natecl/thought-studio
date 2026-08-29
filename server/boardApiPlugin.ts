import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { BoardService } from "../src/domain/BoardService";
import { BoardDomainError } from "../src/domain/errors";
import type { BoardCapability, BoardPrincipal } from "../src/domain/types";
import { parseBoardItems } from "../src/domain/validation";
import { JsonFileBoardRepository } from "../src/infrastructure/JsonFileBoardRepository";

const DEFAULT_WORKSPACE_ID = "personal";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const LOCAL_HUMAN_CAPABILITIES: BoardCapability[] = [
  "board:create",
  "board:read",
  "board:propose",
  "board:write",
  "proposal:review",
];

function localHumanPrincipal(workspaceId: string): BoardPrincipal {
  return {
    participant: { id: "local-user", kind: "human", name: "Local user" },
    grants: [{ workspaceId, capabilities: LOCAL_HUMAN_CAPABILITIES }],
  };
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(`${JSON.stringify(value)}\n`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new BoardDomainError("Request body is too large", "validation_failed");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new BoardDomainError("Request body must be a JSON object", "validation_failed");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BoardDomainError) throw error;
    throw new BoardDomainError("Request body contains invalid JSON", "validation_failed");
  }
}

function requiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new BoardDomainError(`${key} is required`, "validation_failed");
  }
  return value;
}

function requiredNumber(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new BoardDomainError(`${key} must be a non-negative integer`, "validation_failed");
  }
  return value;
}

function requiredBoolean(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "boolean") {
    throw new BoardDomainError(`${key} must be a boolean`, "validation_failed");
  }
  return value;
}

function statusForError(error: BoardDomainError) {
  if (error.code === "not_found") return 404;
  if (error.code === "permission_denied") return 403;
  if (error.code === "version_conflict" || error.code === "proposal_conflict") return 409;
  return 400;
}

async function routeBoardRequest(request: IncomingMessage, response: ServerResponse, service: BoardService) {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const path = requestUrl.pathname;
  if (!path.startsWith("/api/")) return false;

  const workspaceId = requestUrl.searchParams.get("workspaceId") || DEFAULT_WORKSPACE_ID;
  const principal = localHumanPrincipal(workspaceId);

  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, { ok: true, adapter: "local-vite", workspaceId });
    return true;
  }

  if (request.method === "GET" && path === "/api/boards") {
    sendJson(response, 200, await service.listBoards(principal, workspaceId));
    return true;
  }

  if (request.method === "POST" && path === "/api/boards") {
    const body = await readJson(request);
    const requestedWorkspaceId = typeof body.workspaceId === "string" ? body.workspaceId : workspaceId;
    const board = await service.createBoard(localHumanPrincipal(requestedWorkspaceId), {
      boardId: typeof body.boardId === "string" ? body.boardId : undefined,
      workspaceId: requestedWorkspaceId,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      title: requiredString(body, "title"),
      idempotencyKey: requiredString(body, "idempotencyKey"),
    });
    sendJson(response, 201, board);
    return true;
  }

  const boardMatch = path.match(/^\/api\/boards\/([^/]+)$/);
  if (request.method === "PATCH" && boardMatch) {
    const boardId = decodeURIComponent(boardMatch[1]);
    const body = await readJson(request);
    const board = await service.getBoard(principal, boardId);
    sendJson(response, 200, await service.setBoardArchived(localHumanPrincipal(board.workspaceId), {
      boardId,
      archived: requiredBoolean(body, "archived"),
      idempotencyKey: requiredString(body, "idempotencyKey"),
    }));
    return true;
  }

  if (request.method === "DELETE" && boardMatch) {
    const boardId = decodeURIComponent(boardMatch[1]);
    const board = await service.getBoard(principal, boardId);
    sendJson(response, 200, {
      deleted: await service.deleteBoard(localHumanPrincipal(board.workspaceId), { boardId }),
    });
    return true;
  }

  const contextMatch = path.match(/^\/api\/boards\/([^/]+)\/context$/);
  if (request.method === "GET" && contextMatch) {
    const boardId = decodeURIComponent(contextMatch[1]);
    const board = await service.getBoard(principal, boardId);
    const boardPrincipal = localHumanPrincipal(board.workspaceId);
    sendJson(response, 200, await service.getContext(boardPrincipal, {
      boardId,
      frameId: requestUrl.searchParams.get("frameId") || undefined,
    }));
    return true;
  }

  const canvasMatch = path.match(/^\/api\/boards\/([^/]+)\/canvas$/);
  if (request.method === "PUT" && canvasMatch) {
    const boardId = decodeURIComponent(canvasMatch[1]);
    const body = await readJson(request);
    const board = await service.getBoard(principal, boardId);
    sendJson(response, 200, await service.synchronizeCanvas(localHumanPrincipal(board.workspaceId), {
      boardId,
      expectedVersion: requiredNumber(body, "expectedVersion"),
      idempotencyKey: requiredString(body, "idempotencyKey"),
      items: parseBoardItems(body.items),
    }));
    return true;
  }

  sendJson(response, 404, { error: { code: "not_found", message: "API route does not exist" } });
  return true;
}

export function boardApiPlugin(): Plugin {
  const dataPath = resolve(process.env.THOUGHT_STUDIO_DATA_FILE ?? ".thought-studio/boards.json");
  const service = new BoardService(new JsonFileBoardRepository(dataPath));
  return {
    name: "thought-studio-board-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          if (!await routeBoardRequest(request, response, service)) next();
        } catch (error) {
          if (error instanceof BoardDomainError) {
            sendJson(response, statusForError(error), { error: { code: error.code, message: error.message } });
            return;
          }
          server.config.logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
          sendJson(response, 500, { error: { code: "internal_error", message: "The local Board service failed" } });
        }
      });
    },
  };
}
