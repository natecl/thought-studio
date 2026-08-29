import assert from "node:assert/strict";
import test from "node:test";
import { BoardService } from "../src/domain/BoardService";
import { BoardDomainError } from "../src/domain/errors";
import { InMemoryBoardRepository } from "../src/domain/repository";
import type { BoardOperation, BoardPrincipal } from "../src/domain/types";

function deterministicService() {
  let id = 0;
  let tick = 0;
  return new BoardService(new InMemoryBoardRepository(), {
    createId: () => `id-${++id}`,
    now: () => `2026-08-29T12:00:${String(tick++).padStart(2, "0")}.000Z`,
  });
}

function humanPrincipal(workspaceId = "workspace-1"): BoardPrincipal {
  return {
    participant: { id: "human-1", kind: "human", name: "Nathan" },
    grants: [{
      workspaceId,
      capabilities: ["board:create", "board:read", "board:propose", "board:write", "proposal:review"],
    }],
  };
}

function agentPrincipal(workspaceId = "workspace-1"): BoardPrincipal {
  return {
    participant: { id: "agent-1", kind: "agent", name: "Studio researcher" },
    grants: [{ workspaceId, capabilities: ["board:create", "board:read", "board:propose"] }],
  };
}

function createNotesAndConnection(): BoardOperation[] {
  return [
    {
      operationId: "op-note-a",
      type: "object.create",
      object: { id: "note-a", type: "note", x: 100, y: 120, text: "Question" },
    },
    {
      operationId: "op-note-b",
      type: "object.create",
      object: { id: "note-b", type: "note", x: 420, y: 120, text: "Evidence" },
    },
    {
      operationId: "op-connection",
      type: "connection.create",
      connection: {
        id: "connection-a-b",
        type: "connection",
        x: 0,
        y: 0,
        text: "",
        fromId: "note-a",
        toId: "note-b",
      },
    },
  ];
}

test("an agent can create an attributed workspace-owned Board idempotently", async () => {
  const service = deterministicService();
  const agent = agentPrincipal();
  const command = {
    workspaceId: "workspace-1",
    projectId: "project-research",
    title: "Research map",
    idempotencyKey: "create-research-map",
  };

  const created = await service.createBoard(agent, command);
  const retried = await service.createBoard(agent, command);

  assert.equal(created.id, retried.id);
  assert.equal(created.workspaceId, "workspace-1");
  assert.equal(created.projectId, "project-research");
  assert.deepEqual(created.createdBy, agent.participant);
  assert.equal(created.history[0]?.kind, "board.created");
});

test("an agent proposes a batch and a human accepts it with attribution intact", async () => {
  const service = deterministicService();
  const human = humanPrincipal();
  const agent = agentPrincipal();
  const board = await service.createBoard(human, {
    workspaceId: "workspace-1",
    title: "Shared context",
    idempotencyKey: "create-shared-context",
  });

  const proposal = await service.proposeChanges(agent, {
    boardId: board.id,
    expectedVersion: board.version,
    idempotencyKey: "agent-proposal-1",
    prompt: "Map the question to its evidence",
    operations: createNotesAndConnection(),
  });
  assert.equal(proposal.status, "pending");

  const proposedBoard = await service.getBoard(human, board.id);
  const accepted = await service.acceptProposal(human, {
    boardId: board.id,
    proposalId: proposal.id,
    expectedVersion: proposedBoard.version,
    idempotencyKey: "accept-agent-proposal-1",
  });

  assert.equal(accepted.contentVersion, 1);
  assert.equal(accepted.items.length, 3);
  assert.equal(accepted.proposals[0]?.status, "accepted");
  const acceptedNote = accepted.items.find((item) => item.id === "note-a");
  assert.equal(acceptedNote?.type, "note");
  assert.deepEqual(acceptedNote?.createdBy, agent.participant);
  assert.equal(acceptedNote?.type === "note" ? acceptedNote.authoredBy : undefined, "agent");
  assert.equal(accepted.history.at(-1)?.kind, "proposal.accepted");
});

test("an agent cannot bypass Propose mode without an explicit write grant", async () => {
  const service = deterministicService();
  const human = humanPrincipal();
  const agent = agentPrincipal();
  const board = await service.createBoard(human, {
    workspaceId: "workspace-1",
    title: "Protected board",
    idempotencyKey: "create-protected-board",
  });

  await assert.rejects(
    service.applyChanges(agent, {
      boardId: board.id,
      expectedVersion: board.version,
      idempotencyKey: "agent-direct-apply",
      operations: createNotesAndConnection(),
    }),
    (error) => error instanceof BoardDomainError && error.code === "permission_denied",
  );
});

test("accepting a proposal fails when Board content changed after it was proposed", async () => {
  const service = deterministicService();
  const human = humanPrincipal();
  const agent = agentPrincipal();
  const board = await service.createBoard(human, {
    workspaceId: "workspace-1",
    title: "Evolving board",
    idempotencyKey: "create-evolving-board",
  });
  const proposal = await service.proposeChanges(agent, {
    boardId: board.id,
    expectedVersion: board.version,
    idempotencyKey: "stale-proposal",
    operations: createNotesAndConnection(),
  });
  const proposedBoard = await service.getBoard(human, board.id);
  const changed = await service.applyChanges(human, {
    boardId: board.id,
    expectedVersion: proposedBoard.version,
    idempotencyKey: "human-change",
    operations: [{
      operationId: "human-note",
      type: "object.create",
      object: { id: "human-note", type: "note", x: 50, y: 50, text: "New context" },
    }],
  });

  await assert.rejects(
    service.acceptProposal(human, {
      boardId: board.id,
      proposalId: proposal.id,
      expectedVersion: changed.version,
      idempotencyKey: "accept-stale-proposal",
    }),
    (error) => error instanceof BoardDomainError && error.code === "proposal_conflict",
  );
});

test("Frame context contains only the Frame, its children, and internal Connections", async () => {
  const service = deterministicService();
  const human = humanPrincipal();
  const board = await service.createBoard(human, {
    workspaceId: "workspace-1",
    title: "Framed board",
    idempotencyKey: "create-framed-board",
  });
  const withFrame = await service.applyChanges(human, {
    boardId: board.id,
    expectedVersion: board.version,
    idempotencyKey: "create-frame-context",
    operations: [
      ...createNotesAndConnection(),
      {
        operationId: "outside-note",
        type: "object.create",
        object: { id: "note-outside", type: "note", x: 900, y: 900, text: "Outside" },
      },
      {
        operationId: "frame-create",
        type: "frame.create",
        frame: {
          id: "frame-1",
          type: "frame",
          x: 50,
          y: 60,
          width: 700,
          height: 400,
          text: "Evidence frame",
          childIds: ["note-a", "note-b"],
        },
      },
    ],
  });

  const context = await service.getContext(human, { boardId: withFrame.id, frameId: "frame-1" });
  assert.deepEqual(new Set(context.items.map((item) => item.id)), new Set(["frame-1", "note-a", "note-b", "connection-a-b"]));
  assert.equal(context.items.some((item) => item.id === "note-outside"), false);
});
