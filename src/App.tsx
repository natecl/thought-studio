import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCanvas } from "./board/BoardCanvas";
import {
  BoardApiError,
  createServiceBoard,
  deleteServiceBoard,
  listServiceBoards,
  setServiceBoardArchived,
} from "./data/boardServiceClient";
import type { BoardSummary as ServiceBoardSummary } from "./domain/types";
import { boardPlacement, createRecentBoardSummary } from "./shell/boardPlacement";
import { SidebarOpenIcon, WorkspaceSidebar, type BoardSummary } from "./shell/WorkspaceSidebar";

const DEFAULT_TITLE = "Untitled";
const BOARDS_STORAGE_KEY = "thought-studio:boards:v1";
const ACTIVE_BOARD_STORAGE_KEY = "thought-studio:active-board:v1";

function defaultBoards(): BoardSummary[] {
  return [
    {
      id: "primary-board",
      title: localStorage.getItem("thought-studio:title") ?? DEFAULT_TITLE,
      pinned: true,
      recent: true,
      project: "Thought Studio",
    },
    { id: "product-vision", title: "Product vision", pinned: true, project: "Thought Studio" },
    { id: "whiteboard-research", title: "Whiteboard research", recent: true, project: "Research" },
    { id: "agent-collaboration", title: "Agent collaboration", recent: true, project: "Thought Studio" },
  ];
}

function loadBoards(): BoardSummary[] {
  try {
    const stored = localStorage.getItem(BOARDS_STORAGE_KEY);
    if (!stored) return defaultBoards();
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultBoards();
    return parsed.filter((board): board is BoardSummary => {
      if (!board || typeof board !== "object") return false;
      const candidate = board as Partial<BoardSummary>;
      return typeof candidate.id === "string" && typeof candidate.title === "string";
    });
  } catch {
    return defaultBoards();
  }
}

function mergeServiceBoards(current: BoardSummary[], serviceBoards: ServiceBoardSummary[]) {
  const serviceById = new Map(serviceBoards.map((board) => [board.id, board]));
  const merged = current.map((board) => {
    const serviceBoard = serviceById.get(board.id);
    return serviceBoard
      ? {
          ...board,
          title: serviceBoard.title,
          project: serviceBoard.projectId ?? board.project,
          archived: Boolean(serviceBoard.archivedAt),
          serviceVersion: serviceBoard.version,
        }
      : board;
  });
  const knownIds = new Set(merged.map((board) => board.id));
  const discovered = serviceBoards
    .filter((board) => !knownIds.has(board.id))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((board): BoardSummary => ({
      id: board.id,
      title: board.title,
      recent: true,
      project: board.projectId,
      archived: Boolean(board.archivedAt),
      serviceVersion: board.version,
    }));
  return [...merged, ...discovered];
}

function App() {
  const [boards, setBoards] = useState<BoardSummary[]>(loadBoards);
  const boardsRef = useRef(boards);
  const [activeBoardId, setActiveBoardId] = useState(() => {
    const storedId = localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY);
    return boards.some((board) => board.id === storedId) ? storedId! : boards[0].id;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia("(min-width: 821px)").matches);
  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0];

  const createBoard = useCallback(async () => {
    const id = crypto.randomUUID();
    try {
      await createServiceBoard({
        boardId: id,
        title: DEFAULT_TITLE,
        idempotencyKey: `canvas-create:${id}`,
      });
    } catch (error) {
      console.warn("The Board service is unavailable; the new Board remains in this browser.", error);
    }
    setBoards((current) => [
      ...current,
      createRecentBoardSummary(id, DEFAULT_TITLE),
    ]);
    setActiveBoardId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (includeLegacyBoards: boolean) => {
      try {
        let serviceBoards = await listServiceBoards();
        if (includeLegacyBoards) {
          const serviceIds = new Set(serviceBoards.map((board) => board.id));
          for (const board of boardsRef.current) {
            if (serviceIds.has(board.id)) continue;
            try {
              await createServiceBoard({
                boardId: board.id,
                title: board.title,
                projectId: board.project,
                idempotencyKey: `legacy-catalog:${board.id}`,
              });
            } catch (error) {
              if (!(error instanceof BoardApiError && error.code === "version_conflict")) throw error;
            }
          }
          serviceBoards = await listServiceBoards();
        }
        if (!cancelled) setBoards((current) => mergeServiceBoards(current, serviceBoards));
      } catch (error) {
        if (!cancelled) console.warn("The canonical Board catalog is not available yet.", error);
      }
    };

    void refresh(true);
    const interval = window.setInterval(() => void refresh(true), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  const selectBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    if (window.matchMedia("(max-width: 820px)").matches) setIsSidebarOpen(false);
  };

  const toggleBoardPin = (boardId: string) => {
    setBoards((current) =>
      current.map((board) => (board.id === boardId ? { ...board, pinned: !board.pinned } : board)),
    );
  };

  const setBoardArchived = useCallback(async (boardId: string, archived: boolean) => {
    const before = boardsRef.current;
    const target = before.find((board) => board.id === boardId);
    if (!target) return;
    const next = before.map((board) => board.id === boardId
      ? { ...board, archived, pinned: archived ? false : board.pinned }
      : board);
    boardsRef.current = next;
    setBoards(next);

    try {
      const saved = await setServiceBoardArchived({
        boardId,
        archived,
        idempotencyKey: `sidebar-${archived ? "archive" : "restore"}:${boardId}:${crypto.randomUUID()}`,
      });
      setBoards((current) => current.map((board) => board.id === boardId
        ? { ...board, archived: Boolean(saved.archivedAt), serviceVersion: saved.version }
        : board));
      if (archived && activeBoardId === boardId) {
        const fallback = next.find((board) => board.id !== boardId && boardPlacement(board) !== "archived");
        if (fallback) setActiveBoardId(fallback.id);
        else await createBoard();
      }
    } catch (error) {
      boardsRef.current = before;
      setBoards(before);
      console.warn(`The Board could not be ${archived ? "archived" : "restored"}.`, error);
    }
  }, [activeBoardId, createBoard]);

  const deleteBoard = useCallback(async (boardId: string) => {
    const before = boardsRef.current;
    if (!before.some((board) => board.id === boardId)) return;
    if (before.length === 1) {
      console.warn("A workspace must keep at least one Board.");
      return;
    }
    const survivors = before.filter((board) => board.id !== boardId);
    const deletingActiveBoard = activeBoardId === boardId;
    const fallback = survivors.find((board) => boardPlacement(board) !== "archived");
    boardsRef.current = survivors;
    setBoards(survivors);
    if (deletingActiveBoard && fallback) setActiveBoardId(fallback.id);

    try {
      await deleteServiceBoard(boardId);
      if (deletingActiveBoard && !fallback) await createBoard();
    } catch (error) {
      boardsRef.current = before;
      setBoards(before);
      if (deletingActiveBoard) setActiveBoardId(boardId);
      console.warn("The Board could not be deleted.", error);
    }
  }, [activeBoardId, createBoard]);

  useEffect(() => {
    localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, activeBoardId);
  }, [activeBoardId]);

  useEffect(() => {
    const createWithShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createBoard();
      }
    };
    const preventPageZoomShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && ["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault();
      }
    };
    const preventPagePinchZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    window.addEventListener("keydown", preventPageZoomShortcut, { capture: true });
    window.addEventListener("keydown", createWithShortcut);
    window.addEventListener("wheel", preventPagePinchZoom, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", preventPageZoomShortcut, { capture: true });
      window.removeEventListener("keydown", createWithShortcut);
      window.removeEventListener("wheel", preventPagePinchZoom, { capture: true });
    };
  }, [createBoard]);

  return (
    <main className={`workspace${isSidebarOpen ? " is-sidebar-open" : ""}`} aria-label={`${activeBoard.title} Board`}>
      <BoardCanvas key={activeBoardId} boardId={activeBoardId} title={activeBoard.title} />

      {isSidebarOpen && (
        <WorkspaceSidebar
          boards={boards}
          activeBoardId={activeBoardId}
          onClose={() => setIsSidebarOpen(false)}
          onCreateBoard={createBoard}
          onSelectBoard={selectBoard}
          onTogglePin={toggleBoardPin}
          onSetArchived={setBoardArchived}
          onDeleteBoard={deleteBoard}
        />
      )}

      {isSidebarOpen && (
        <button className="sidebar-backdrop" type="button" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar" />
      )}

      {!isSidebarOpen && (
        <button className="sidebar-reveal-button" type="button" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar">
          <SidebarOpenIcon />
        </button>
      )}
    </main>
  );
}

export default App;
