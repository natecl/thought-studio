import assert from "node:assert/strict";
import test from "node:test";
import { inferCardRole, inferConnectionKind, splitCardText } from "../src/board/semantics";
import { inferSourceFormat } from "../src/board/sourceFormat";
import { parseBoardOperations } from "../src/domain/operations";
import { parseBoardItems } from "../src/domain/validation";

test("semantic roles and relations survive Board validation", () => {
  const items = parseBoardItems([
    { id: "claim", type: "note", x: 0, y: 0, text: "Product claim", semanticRole: "thought" },
    { id: "proof", type: "note", x: 260, y: 0, text: "Research signal", semanticRole: "evidence" },
    { id: "proof-claim", type: "connection", x: 0, y: 0, text: "", fromId: "proof", toId: "claim", relation: "supports" },
  ]);

  assert.equal(items[0]?.type === "note" && items[0].semanticRole, "thought");
  assert.equal(items[2]?.type === "connection" && items[2].relation, "supports");
});

test("invalid semantic values are rejected for synchronized and agent-created material", () => {
  assert.throws(() => parseBoardItems([
    { id: "bad", type: "note", x: 0, y: 0, text: "Bad", semanticRole: "agent" },
  ]), /invalid Board item/);

  assert.throws(() => parseBoardOperations([{
    operationId: "bad-relation",
    type: "connection.create",
    connection: { id: "line", type: "connection", x: 0, y: 0, text: "", fromId: "a", toId: "b", relation: "agrees_with" },
  }]), /unsupported Connection relation/);
});

test("legacy Board material receives a quiet semantic fallback without using authorship", () => {
  const agentQuestion = { id: "question", type: "note" as const, x: 0, y: 0, text: "Open question\nWhat is missing?", authoredBy: "agent" as const };
  const humanQuestion = { ...agentQuestion, id: "human-question", authoredBy: undefined };
  const evidence = { id: "evidence", type: "note" as const, x: 0, y: 0, text: "Quote", sourceId: "source" };
  const connection = { id: "line", type: "connection" as const, x: 0, y: 0, text: "", fromId: "evidence", toId: "question" };

  assert.equal(inferCardRole(agentQuestion), "question");
  assert.equal(inferCardRole(humanQuestion), "question");
  assert.equal(inferCardRole(evidence), "evidence");
  assert.equal(inferConnectionKind(connection, [agentQuestion, evidence, connection]), "supports");
  assert.deepEqual(splitCardText("Title\nSupporting detail"), { title: "Title", detail: "Supporting detail" });
});

test("Sources communicate their material format independently of provenance origin", () => {
  assert.equal(inferSourceFormat({ sourceKind: "url", url: "https://youtube.com/watch?v=123" }), "video");
  assert.equal(inferSourceFormat({ sourceKind: "url", url: "https://github.com/acme/product/blob/main/README.md" }), "document");
  assert.equal(inferSourceFormat({ sourceKind: "file", url: "data:text/csv;base64,", fileName: "research.csv", mimeType: "text/csv" }), "data");
  assert.equal(inferSourceFormat({ sourceKind: "file", url: "data:text/plain;base64,", fileName: "agent.ts", mimeType: "text/plain" }), "code");
});
