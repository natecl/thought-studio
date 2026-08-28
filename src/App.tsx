import { useCallback, useEffect, useState } from "react";
import { BoardCanvas } from "./board/BoardCanvas";
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

function App() {
  const [boards, setBoards] = useState<BoardSummary[]>(loadBoards);
  const [activeBoardId, setActiveBoardId] = useState(() => {
    const storedId = localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY);
    return boards.some((board) => board.id === storedId) ? storedId! : boards[0].id;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia("(min-width: 821px)").matches);
  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0];

  const createBoard = useCallback(() => {
    const id = crypto.randomUUID();
    setBoards((current) => [
      ...current,
      { id, title: DEFAULT_TITLE, recent: true, project: "Thought Studio" },
    ]);
    setActiveBoardId(id);
  }, []);

  const selectBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    if (window.matchMedia("(max-width: 820px)").matches) setIsSidebarOpen(false);
  };

  const toggleBoardPin = (boardId: string) => {
    setBoards((current) =>
      current.map((board) => (board.id === boardId ? { ...board, pinned: !board.pinned } : board)),
    );
  };

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
    window.addEventListener("keydown", createWithShortcut);
    return () => window.removeEventListener("keydown", createWithShortcut);
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
