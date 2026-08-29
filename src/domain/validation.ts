import { invariant } from "./errors";
import type {
  AgentSourceReference,
  BoardItem,
  BoardSourceKind,
  ParticipantRef,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSourceKind(value: unknown): value is BoardSourceKind {
  return value === "url" || value === "image" || value === "file";
}

function isParticipant(value: unknown): value is ParticipantRef {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" &&
    (value.kind === "human" || value.kind === "agent" || value.kind === "import" || value.kind === "system");
}

function hasOptionalAttribution(value: Record<string, unknown>) {
  return (value.createdBy === undefined || isParticipant(value.createdBy)) &&
    isOptionalString(value.createdAt) && isOptionalString(value.updatedAt);
}

function isAgentSource(value: unknown): value is AgentSourceReference {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.origin === "string" && typeof value.url === "string" &&
    isSourceKind(value.sourceKind) && isOptionalString(value.fileName);
}

function isBoardItem(value: unknown): value is BoardItem {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0 || !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) || typeof value.text !== "string" || !hasOptionalAttribution(value)) return false;

  if (value.type === "text" || value.type === "note") {
    return isOptionalString(value.sourceId) && isOptionalString(value.sourceTitle) &&
      isOptionalString(value.sourceOrigin) && isOptionalString(value.sourceUrl) &&
      (value.sourceKind === undefined || isSourceKind(value.sourceKind)) &&
      isOptionalString(value.sourceFileName) &&
      (value.sourceLinkKind === undefined || value.sourceLinkKind === "note" || value.sourceLinkKind === "quote") &&
      (value.authoredBy === undefined || value.authoredBy === "agent") &&
      isOptionalString(value.authorName) && isOptionalString(value.proposalPrompt) &&
      (value.agentScopeIds === undefined || isStringArray(value.agentScopeIds)) &&
      (value.agentScopeLabels === undefined || isStringArray(value.agentScopeLabels)) &&
      (value.agentSources === undefined || Array.isArray(value.agentSources) && value.agentSources.every(isAgentSource));
  }

  if (value.type === "source") {
    return isSourceKind(value.sourceKind) && typeof value.url === "string" &&
      typeof value.origin === "string" && typeof value.importedAt === "string" &&
      isFiniteNumber(value.width) && value.width > 0 && isFiniteNumber(value.height) && value.height > 0 &&
      isOptionalString(value.mimeType) && isOptionalString(value.fileName) &&
      (value.fileSize === undefined || isFiniteNumber(value.fileSize) && value.fileSize >= 0) &&
      isOptionalString(value.previewDataUrl);
  }

  if (value.type === "connection") {
    return typeof value.fromId === "string" && typeof value.toId === "string" && value.fromId !== value.toId;
  }

  if (value.type === "frame") {
    return isFiniteNumber(value.width) && value.width > 0 && isFiniteNumber(value.height) && value.height > 0 &&
      isStringArray(value.childIds);
  }

  if (value.type === "proposal") {
    return typeof value.prompt === "string" && typeof value.agentName === "string" &&
      isStringArray(value.scopeIds) && isStringArray(value.scopeLabels) &&
      Array.isArray(value.sources) && value.sources.every(isAgentSource) &&
      typeof value.createdAt === "string" && isFiniteNumber(value.width) && value.width > 0 &&
      isFiniteNumber(value.height) && value.height > 0;
  }

  return false;
}

export function parseBoardItems(value: unknown): BoardItem[] {
  invariant(Array.isArray(value), "Canvas items must be an array");
  invariant(value.every(isBoardItem), "Canvas contains an invalid Board item");

  const items = structuredClone(value);
  const ids = new Set<string>();
  for (const item of items) {
    invariant(!ids.has(item.id), `Canvas contains duplicate item id "${item.id}"`);
    ids.add(item.id);
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    if (item.type === "connection") {
      const from = itemsById.get(item.fromId);
      const to = itemsById.get(item.toId);
      invariant(from && from.type !== "connection", `Connection "${item.id}" has an invalid from endpoint`);
      invariant(to && to.type !== "connection", `Connection "${item.id}" has an invalid to endpoint`);
    }
    if (item.type === "frame") {
      invariant(new Set(item.childIds).size === item.childIds.length, `Frame "${item.id}" contains duplicate children`);
      for (const childId of item.childIds) {
        const child = itemsById.get(childId);
        invariant(child && child.type !== "connection" && child.id !== item.id,
          `Frame "${item.id}" contains invalid child "${childId}"`);
      }
    }
  }
  return items;
}
