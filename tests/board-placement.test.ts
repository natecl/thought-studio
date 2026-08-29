import assert from "node:assert/strict";
import test from "node:test";
import { boardPlacement, createRecentBoardSummary } from "../src/shell/boardPlacement";

test("New Board creates a workspace-level Recent without Project ownership", () => {
  const board = createRecentBoardSummary("new-board", "Untitled");

  assert.equal(boardPlacement(board), "recent");
  assert.equal(board.project, undefined);
});

test("Pinned placement wins while Project ownership remains attached", () => {
  const board = {
    id: "pinned-project-board",
    title: "Pinned Project Board",
    pinned: true,
    recent: true,
    project: "Thought Studio",
  };

  assert.equal(boardPlacement(board), "pinned");
  assert.equal(board.project, "Thought Studio");
});

test("an unpinned Project Board appears only in its Project", () => {
  assert.equal(boardPlacement({
    id: "project-board",
    title: "Project Board",
    recent: true,
    project: "Research",
  }), "project");
});

test("Recents contains only unpinned Boards without Project ownership", () => {
  assert.equal(boardPlacement({ id: "recent-board", title: "Recent Board", recent: true }), "recent");
  assert.equal(boardPlacement({ id: "unplaced-board", title: "Unplaced Board" }), null);
});
