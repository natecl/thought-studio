#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BoardService } from "../src/domain/BoardService";
import { BoardDomainError } from "../src/domain/errors";
import { parseBoardOperations } from "../src/domain/operations";
import type { BoardCapability, BoardPrincipal, BoardScope, ParticipantKind } from "../src/domain/types";
import { JsonFileBoardRepository } from "../src/infrastructure/JsonFileBoardRepository";

interface ParsedArguments {
  positionals: string[];
  options: Map<string, string | true>;
}

const HELP = `Thought Studio CLI

Usage:
  thought boards create --title <title> [--workspace <id>] [--project <id>]
  thought boards list [--workspace <id>]
  thought boards inspect <board-id> [--frame <frame-id>] [--workspace <id>]
  thought boards propose <board-id> --file <operations.json> [--frame <frame-id>] [--prompt <text>]
  thought proposals accept <board-id> <proposal-id>
  thought proposals reject <board-id> <proposal-id>

Participant options:
  --actor <id>             Defaults to local-user
  --actor-name <name>      Defaults to Local user
  --actor-type <kind>      human or agent; defaults to human
  --allow-write            Explicitly grants local direct-write and proposal-review capabilities

Storage options:
  --data <path>            Defaults to .thought-studio/boards.json
  THOUGHT_STUDIO_DATA_FILE may also set the storage path.

Operations are typed JSON objects. Agent principals can create, read, and propose by default.
Review requires a human principal or the explicit --allow-write development flag.`;

function parseArguments(args: string[]): ParsedArguments {
  const positionals: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) options.set(name, true);
    else {
      options.set(name, next);
      index += 1;
    }
  }
  return { positionals, options };
}

function option(arguments_: ParsedArguments, name: string, fallback?: string) {
  const value = arguments_.options.get(name);
  return typeof value === "string" ? value : fallback;
}

function requiredOption(arguments_: ParsedArguments, name: string) {
  const value = option(arguments_, name);
  if (!value) throw new BoardDomainError(`--${name} is required`, "validation_failed");
  return value;
}

function principalFor(arguments_: ParsedArguments, workspaceId: string): BoardPrincipal {
  const actorType = option(arguments_, "actor-type", "human") as ParticipantKind;
  if (actorType !== "human" && actorType !== "agent") {
    throw new BoardDomainError("--actor-type must be human or agent", "validation_failed");
  }
  const capabilities: BoardCapability[] = ["board:create", "board:read", "board:propose"];
  if (actorType === "human" || arguments_.options.has("allow-write")) {
    capabilities.push("board:write", "proposal:review");
  }
  return {
    participant: {
      id: option(arguments_, "actor", actorType === "agent" ? "local-agent" : "local-user")!,
      kind: actorType,
      name: option(arguments_, "actor-name", actorType === "agent" ? "Local agent" : "Local user")!,
    },
    grants: [{ workspaceId, capabilities }],
  };
}

function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function run() {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.options.has("help") || arguments_.positionals.length === 0) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const [group, action, ...identifiers] = arguments_.positionals;
  const workspaceId = option(arguments_, "workspace", "personal")!;
  const dataPath = resolve(option(arguments_, "data", process.env.THOUGHT_STUDIO_DATA_FILE ?? ".thought-studio/boards.json")!);
  const service = new BoardService(new JsonFileBoardRepository(dataPath));
  const principal = principalFor(arguments_, workspaceId);

  if (group === "boards" && action === "create") {
    const board = await service.createBoard(principal, {
      workspaceId,
      projectId: option(arguments_, "project"),
      title: requiredOption(arguments_, "title"),
      idempotencyKey: option(arguments_, "idempotency-key", crypto.randomUUID())!,
    });
    output(board);
    return;
  }

  if (group === "boards" && action === "list") {
    output(await service.listBoards(principal, workspaceId));
    return;
  }

  if (group === "boards" && action === "inspect") {
    const boardId = identifiers[0];
    if (!boardId) throw new BoardDomainError("boards inspect requires <board-id>", "validation_failed");
    output(await service.getContext(principal, { boardId, frameId: option(arguments_, "frame") }));
    return;
  }

  if (group === "boards" && action === "propose") {
    const boardId = identifiers[0];
    if (!boardId) throw new BoardDomainError("boards propose requires <board-id>", "validation_failed");
    const board = await service.getBoard(principal, boardId);
    const operations = parseBoardOperations(JSON.parse(await readFile(resolve(requiredOption(arguments_, "file")), "utf8")));
    const frameId = option(arguments_, "frame");
    const scope: BoardScope = frameId ? { type: "frame", boardId, frameId } : { type: "board", boardId };
    output(await service.proposeChanges(principal, {
      boardId,
      expectedVersion: board.version,
      idempotencyKey: option(arguments_, "idempotency-key", crypto.randomUUID())!,
      prompt: option(arguments_, "prompt"),
      scope,
      operations,
    }));
    return;
  }

  if (group === "proposals" && (action === "accept" || action === "reject")) {
    const [boardId, proposalId] = identifiers;
    if (!boardId || !proposalId) throw new BoardDomainError(`proposals ${action} requires <board-id> <proposal-id>`, "validation_failed");
    const board = await service.getBoard(principal, boardId);
    const command = {
      boardId,
      proposalId,
      expectedVersion: board.version,
      idempotencyKey: option(arguments_, "idempotency-key", crypto.randomUUID())!,
    };
    output(action === "accept"
      ? await service.acceptProposal(principal, command)
      : await service.rejectProposal(principal, command));
    return;
  }

  throw new BoardDomainError(`Unknown command: ${arguments_.positionals.join(" ")}`, "validation_failed");
}

run().catch((error: unknown) => {
  if (error instanceof BoardDomainError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`unexpected_error: ${message}\n`);
  process.exitCode = 1;
});
