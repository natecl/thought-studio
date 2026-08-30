import { invariant } from "./errors";
import type {
  BoardConnection,
  BoardFrame,
  BoardItem,
  BoardObject,
  BoardOperation,
  BoardScope,
  BoardSource,
  ParticipantRef,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isCardRole(value: unknown) {
  return value === "thought" || value === "evidence" || value === "question" || value === "decision";
}

function isConnectionKind(value: unknown) {
  return value === "relates" || value === "supports" || value === "challenges" ||
    value === "depends_on" || value === "leads_to" || value === "references";
}

function isSourceFormat(value: unknown) {
  return value === "webpage" || value === "video" || value === "document" || value === "code" ||
    value === "data" || value === "image" || value === "file";
}

function assertEntityBase(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> & { id: string; x: number; y: number; text: string } {
  invariant(isRecord(value) && isString(value.id) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && typeof value.text === "string", message);
}

function parseOperation(value: unknown, index: number): BoardOperation {
  invariant(isRecord(value), `Operation ${index + 1} must be an object`);
  invariant(isString(value.operationId), `Operation ${index + 1} requires operationId`);
  invariant(isString(value.type), `Operation ${index + 1} requires type`);

  switch (value.type) {
    case "object.create": {
      const object = value.object;
      assertEntityBase(object, `Operation ${index + 1} requires a valid object`);
      invariant(object.type === "text" || object.type === "note", `Operation ${index + 1} has an unsupported Object type`);
      invariant(object.semanticRole === undefined || isCardRole(object.semanticRole), `Operation ${index + 1} has an unsupported card role`);
      return value as unknown as BoardOperation;
    }
    case "source.create": {
      const source = value.source;
      assertEntityBase(source, `Operation ${index + 1} requires a valid Source`);
      invariant(source.type === "source", `Operation ${index + 1} requires Source type`);
      invariant(source.sourceKind === "url" || source.sourceKind === "image" || source.sourceKind === "file", `Operation ${index + 1} has an unsupported Source kind`);
      invariant(source.sourceFormat === undefined || isSourceFormat(source.sourceFormat), `Operation ${index + 1} has an unsupported Source format`);
      invariant(typeof source.url === "string" && isString(source.origin) && isString(source.importedAt), `Operation ${index + 1} requires Source provenance`);
      invariant(isFiniteNumber(source.width) && isFiniteNumber(source.height), `Operation ${index + 1} requires Source dimensions`);
      return value as unknown as BoardOperation;
    }
    case "connection.create": {
      const connection = value.connection;
      assertEntityBase(connection, `Operation ${index + 1} requires a valid Connection`);
      invariant(connection.type === "connection" && isString(connection.fromId) && isString(connection.toId), `Operation ${index + 1} requires Connection endpoints`);
      invariant(connection.relation === undefined || isConnectionKind(connection.relation), `Operation ${index + 1} has an unsupported Connection relation`);
      return value as unknown as BoardOperation;
    }
    case "frame.create": {
      const frame = value.frame;
      assertEntityBase(frame, `Operation ${index + 1} requires a valid Frame`);
      invariant(frame.type === "frame" && isFiniteNumber(frame.width) && isFiniteNumber(frame.height), `Operation ${index + 1} requires Frame dimensions`);
      invariant(isStringArray(frame.childIds), `Operation ${index + 1} requires Frame childIds`);
      return value as unknown as BoardOperation;
    }
    case "entity.update_text":
      invariant(isString(value.entityId) && typeof value.text === "string", `Operation ${index + 1} requires entityId and text`);
      return value as unknown as BoardOperation;
    case "entities.move":
      invariant(isStringArray(value.entityIds) && value.entityIds.length > 0, `Operation ${index + 1} requires entityIds`);
      invariant(isRecord(value.delta) && isFiniteNumber(value.delta.x) && isFiniteNumber(value.delta.y), `Operation ${index + 1} requires a finite delta`);
      return value as unknown as BoardOperation;
    case "entities.delete":
      invariant(isStringArray(value.entityIds) && value.entityIds.length > 0, `Operation ${index + 1} requires entityIds`);
      return value as unknown as BoardOperation;
    case "frame.set_children":
      invariant(isString(value.frameId) && isStringArray(value.childIds), `Operation ${index + 1} requires frameId and childIds`);
      return value as unknown as BoardOperation;
    default:
      invariant(false, `Operation ${index + 1} has unsupported type "${value.type}"`);
  }
}

export function parseBoardOperations(value: unknown): BoardOperation[] {
  invariant(Array.isArray(value), "Operations payload must be an array");
  invariant(value.length > 0, "At least one Board operation is required");
  const operations = value.map(parseOperation);
  const operationIds = new Set(operations.map((operation) => operation.operationId));
  invariant(operationIds.size === operations.length, "Operation IDs must be unique within a batch");
  return operations;
}

function attributed<T extends BoardItem>(item: T, actor: ParticipantRef, timestamp: string): T {
  return {
    ...item,
    createdBy: actor,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(item.type === "text" || item.type === "note"
      ? { authoredBy: actor.kind === "agent" ? "agent" as const : undefined, authorName: actor.name }
      : {}),
  };
}

function requireEntity(items: BoardItem[], id: string) {
  const item = items.find((candidate) => candidate.id === id);
  invariant(item, `Board entity "${id}" does not exist`);
  return item;
}

function requireNewEntity(items: BoardItem[], id: string) {
  invariant(!items.some((item) => item.id === id), `Board entity "${id}" already exists`);
}

function validateFrameChildren(items: BoardItem[], childIds: string[]) {
  const uniqueChildIds = new Set(childIds);
  invariant(uniqueChildIds.size === childIds.length, "Frame child IDs must be unique");
  childIds.forEach((id) => {
    const child = requireEntity(items, id);
    invariant(child.type !== "frame" && child.type !== "connection", "Frames may contain Objects, Sources, and Proposals only");
  });
}

function assignFrameChildren(items: BoardItem[], frameId: string, childIds: string[], timestamp: string) {
  const assignedIds = new Set(childIds);
  return items.map((item) => {
    if (item.type !== "frame") return item;
    if (item.id === frameId) return { ...item, childIds, updatedAt: timestamp };
    const nextChildIds = item.childIds.filter((id) => !assignedIds.has(id));
    return nextChildIds.length === item.childIds.length ? item : { ...item, childIds: nextChildIds, updatedAt: timestamp };
  });
}

export function applyBoardOperations(
  currentItems: BoardItem[],
  operations: BoardOperation[],
  actor: ParticipantRef,
  timestamp: string,
) {
  let items = structuredClone(currentItems);

  for (const operation of operations) {
    switch (operation.type) {
      case "object.create": {
        requireNewEntity(items, operation.object.id);
        items = [...items, attributed(operation.object as BoardObject, actor, timestamp)];
        break;
      }
      case "source.create": {
        requireNewEntity(items, operation.source.id);
        items = [...items, attributed(operation.source as BoardSource, actor, timestamp)];
        break;
      }
      case "connection.create": {
        requireNewEntity(items, operation.connection.id);
        const from = requireEntity(items, operation.connection.fromId);
        const to = requireEntity(items, operation.connection.toId);
        invariant(from.id !== to.id, "A Connection requires two different endpoints");
        invariant(from.type !== "connection" && to.type !== "connection", "A Connection cannot target another Connection in this milestone");
        items = [...items, attributed(operation.connection as BoardConnection, actor, timestamp)];
        break;
      }
      case "frame.create": {
        requireNewEntity(items, operation.frame.id);
        validateFrameChildren(items, operation.frame.childIds);
        items = [...items, attributed(operation.frame as BoardFrame, actor, timestamp)];
        items = assignFrameChildren(items, operation.frame.id, operation.frame.childIds, timestamp);
        break;
      }
      case "entity.update_text":
        requireEntity(items, operation.entityId);
        items = items.map((item) => item.id === operation.entityId ? { ...item, text: operation.text, updatedAt: timestamp } : item);
        break;
      case "entities.move": {
        const moveIds = new Set(operation.entityIds);
        operation.entityIds.forEach((id) => {
          const item = requireEntity(items, id);
          if (item.type === "frame") item.childIds.forEach((childId) => moveIds.add(childId));
        });
        items = items.map((item) => moveIds.has(item.id) && item.type !== "connection"
          ? { ...item, x: item.x + operation.delta.x, y: item.y + operation.delta.y, updatedAt: timestamp }
          : item);
        break;
      }
      case "entities.delete": {
        operation.entityIds.forEach((id) => requireEntity(items, id));
        const deletedIds = new Set(operation.entityIds);
        items = items
          .filter((item) => !deletedIds.has(item.id))
          .filter((item) => item.type !== "connection" || (!deletedIds.has(item.fromId) && !deletedIds.has(item.toId)))
          .map((item) => item.type === "frame"
            ? { ...item, childIds: item.childIds.filter((id) => !deletedIds.has(id)), updatedAt: timestamp }
            : item);
        break;
      }
      case "frame.set_children": {
        const frame = requireEntity(items, operation.frameId);
        invariant(frame.type === "frame", `Board entity "${operation.frameId}" is not a Frame`);
        validateFrameChildren(items, operation.childIds);
        items = assignFrameChildren(items, operation.frameId, operation.childIds, timestamp)
          .map((item) => item.id === operation.frameId ? { ...item, updatedAt: timestamp } : item);
        break;
      }
    }
  }

  return items;
}

function existingTargetIds(operation: BoardOperation) {
  switch (operation.type) {
    case "object.create":
    case "source.create":
    case "frame.create":
      return [];
    case "connection.create":
      return [operation.connection.fromId, operation.connection.toId];
    case "entity.update_text":
      return [operation.entityId];
    case "entities.move":
    case "entities.delete":
      return operation.entityIds;
    case "frame.set_children":
      return [operation.frameId, ...operation.childIds];
  }
}

export function validateOperationsForScope(items: BoardItem[], operations: BoardOperation[], scope: BoardScope) {
  if (scope.type === "board") return;
  const frame = items.find((item): item is BoardFrame => item.id === scope.frameId && item.type === "frame");
  invariant(frame, `Frame "${scope.frameId}" does not exist`);

  const createdIds = new Set(operations.flatMap((operation) => {
    if (operation.type === "object.create") return [operation.object.id];
    if (operation.type === "source.create") return [operation.source.id];
    return [];
  }));
  const allowedIds = new Set([frame.id, ...frame.childIds, ...createdIds]);

  operations.forEach((operation) => {
    invariant(operation.type !== "frame.create", "Nested Frame creation is not supported inside Frame scope");
    if (operation.type === "frame.set_children") {
      invariant(operation.frameId === frame.id, "A Frame-scoped change cannot reassign another Frame");
    }
    existingTargetIds(operation).forEach((id) => {
      invariant(allowedIds.has(id), `Entity "${id}" is outside the permitted Frame scope`);
    });
  });
}
