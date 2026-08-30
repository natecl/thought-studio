import type { BoardCardRole, BoardConnection, BoardConnectionKind, BoardItem, BoardObject } from "./types";

export const CARD_ROLES: Array<{ value: BoardCardRole; label: string; symbol: string }> = [
  { value: "thought", label: "Thought", symbol: "●" },
  { value: "evidence", label: "Evidence", symbol: "◆" },
  { value: "question", label: "Question", symbol: "?" },
  { value: "decision", label: "Decision", symbol: "✓" },
];

export const CONNECTION_KINDS: Array<{ value: BoardConnectionKind; label: string }> = [
  { value: "relates", label: "Relates" },
  { value: "supports", label: "Supports" },
  { value: "challenges", label: "Challenges" },
  { value: "depends_on", label: "Depends on" },
  { value: "leads_to", label: "Leads to" },
  { value: "references", label: "References" },
];

export function inferCardRole(item: BoardObject): BoardCardRole {
  if (item.semanticRole) return item.semanticRole;
  if (item.sourceId || item.sourceLinkKind) return "evidence";
  const firstLine = item.text.trim().split("\n", 1)[0].toLowerCase();
  if (firstLine.includes("?") || /^(question|tension|risk|open question|unknown|challenge)\b/.test(firstLine)) return "question";
  if (/^(decision|promise|product truth|guardrail|competitive boundary|success test|creation|ship)\b/.test(firstLine)) return "decision";
  if (/^(evidence|source|research|provenance|signal|finding)\b/.test(firstLine)) return "evidence";
  return "thought";
}

export function inferConnectionKind(connection: BoardConnection, items: BoardItem[]): BoardConnectionKind {
  if (connection.relation) return connection.relation;
  const from = items.find((item) => item.id === connection.fromId);
  const to = items.find((item) => item.id === connection.toId);
  if (from?.type === "source" || to?.type === "source") return "references";
  if (from?.type === "note" && to?.type === "note") {
    const fromRole = inferCardRole(from);
    const toRole = inferCardRole(to);
    if (fromRole === "evidence" && toRole !== "evidence") return "supports";
    if (fromRole === "question" || toRole === "question") return "challenges";
    if (toRole === "decision") return "leads_to";
  }
  return "relates";
}

export function splitCardText(text: string) {
  const [firstLine = "", ...rest] = text.trim().split("\n");
  return { title: firstLine || "Untitled", detail: rest.join("\n").trim() };
}

export function connectionKindLabel(kind: BoardConnectionKind) {
  return CONNECTION_KINDS.find((candidate) => candidate.value === kind)?.label ?? "Relates";
}
