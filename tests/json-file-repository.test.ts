import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonFileBoardRepository } from "../src/infrastructure/JsonFileBoardRepository";
import { BoardService } from "../src/domain/BoardService";
import { BoardDomainError } from "../src/domain/errors";
import type { BoardPrincipal } from "../src/domain/types";

const principal: BoardPrincipal = {
  participant: { id: "local-agent", kind: "agent", name: "Local agent" },
  grants: [{ workspaceId: "workspace-file-test", capabilities: ["board:create", "board:read", "board:propose"] }],
};

test("the JSON repository persists Boards for a new service process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "thought-studio-board-service-"));
  const filePath = join(directory, "boards.json");
  const firstService = new BoardService(new JsonFileBoardRepository(filePath));
  const created = await firstService.createBoard(principal, {
    workspaceId: "workspace-file-test",
    title: "Persisted agent Board",
    idempotencyKey: "persist-board",
  });

  const secondService = new BoardService(new JsonFileBoardRepository(filePath));
  const loaded = await secondService.getBoard(principal, created.id);

  assert.equal(loaded.title, "Persisted agent Board");
  assert.deepEqual(loaded.createdBy, principal.participant);
  assert.equal(loaded.version, 1);
});

test("the JSON repository rejects stale aggregate versions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "thought-studio-version-test-"));
  const repository = new JsonFileBoardRepository(join(directory, "boards.json"));
  const service = new BoardService(repository);
  const created = await service.createBoard(principal, {
    workspaceId: "workspace-file-test",
    title: "Versioned Board",
    idempotencyKey: "versioned-board",
  });

  await assert.rejects(
    repository.save({ ...created, version: 2 }, 0),
    (error) => error instanceof BoardDomainError && error.code === "version_conflict",
  );
});

test("separate local adapters serialize concurrent Board creation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "thought-studio-concurrent-test-"));
  const filePath = join(directory, "boards.json");
  const firstService = new BoardService(new JsonFileBoardRepository(filePath));
  const secondService = new BoardService(new JsonFileBoardRepository(filePath));

  await Promise.all([
    firstService.createBoard(principal, {
      boardId: "concurrent-one",
      workspaceId: "workspace-file-test",
      title: "Concurrent one",
      idempotencyKey: "concurrent-one",
    }),
    secondService.createBoard(principal, {
      boardId: "concurrent-two",
      workspaceId: "workspace-file-test",
      title: "Concurrent two",
      idempotencyKey: "concurrent-two",
    }),
  ]);

  const boards = await firstService.listBoards(principal, "workspace-file-test");
  assert.deepEqual(new Set(boards.map((board) => board.id)), new Set(["concurrent-one", "concurrent-two"]));
});
