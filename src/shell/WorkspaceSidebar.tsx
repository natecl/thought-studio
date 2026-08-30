import { useEffect, useMemo, useState, type ReactNode } from "react";
import bloomMark from "../../docs/design/brand/thought-bloom-mark-selected.png";
import { boardPlacement, type BoardSummary } from "./boardPlacement";

export type { BoardSummary } from "./boardPlacement";

interface WorkspaceSidebarProps {
  boards: BoardSummary[];
  activeBoardId: string;
  onClose: () => void;
  onCreateBoard: () => void;
  onSelectBoard: (boardId: string) => void;
  onTogglePin: (boardId: string) => void;
  onSetArchived: (boardId: string, archived: boolean) => void | Promise<void>;
  onDeleteBoard: (boardId: string) => void | Promise<void>;
}

export function WorkspaceSidebar({
  boards,
  activeBoardId,
  onClose,
  onCreateBoard,
  onSelectBoard,
  onTogglePin,
  onSetArchived,
  onDeleteBoard,
}: WorkspaceSidebarProps) {
  const [query, setQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState(() => new Set(["Thought Studio"]));
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<BoardSummary | null>(null);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteCandidate(null);
      }
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const filteredBoards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return boards;
    return boards.filter((board) => board.title.toLocaleLowerCase().includes(normalizedQuery));
  }, [boards, query]);

  const projects = useMemo(
    () => Array.from(new Set(boards.flatMap((board) => (board.project ? [board.project] : [])))),
    [boards],
  );
  const pinnedBoards = filteredBoards.filter((board) => boardPlacement(board) === "pinned");
  const recentBoards = filteredBoards.filter((board) => boardPlacement(board) === "recent");
  const archivedBoards = filteredBoards.filter((board) => boardPlacement(board) === "archived");

  const toggleProject = (project: string) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  };

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <div className="workspace-switcher-row">
        <div className="workspace-brand" aria-label="Thought Studio">
          <img src={bloomMark} alt="" />
          <span>Thought Studio</span>
        </div>
        <button className="sidebar-icon-button" type="button" onClick={onClose} aria-label="Collapse sidebar">
          <SidebarCloseIcon />
        </button>
      </div>

      <div className="sidebar-actions" aria-label="Board actions">
        <button type="button" onClick={onCreateBoard}>
          <NewBoardIcon />
          <span>New Board</span>
          <kbd>⌘N</kbd>
        </button>
        <label className="sidebar-search">
          <SearchIcon />
          <span className="sr-only">Search Boards</span>
          <input
            type="search"
            value={query}
            placeholder="Search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <nav className="sidebar-navigation" aria-label="Boards and projects">
        <SidebarSection title="Pinned">
          {pinnedBoards.map((board) => (
            <BoardRow
              key={`pinned-${board.id}`}
              board={board}
              active={board.id === activeBoardId}
              onSelect={onSelectBoard}
              onTogglePin={onTogglePin}
              onSetArchived={onSetArchived}
              onRequestDelete={setDeleteCandidate}
              canDelete={boards.length > 1}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Projects" action={<button type="button" aria-label="Create project">+</button>}>
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project);
            const projectBoards = filteredBoards.filter((board) =>
              board.project === project && boardPlacement(board) === "project");
            if (query && projectBoards.length === 0) return null;

            return (
              <div className="project-group" key={project}>
                <button
                  className="project-row"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleProject(project)}
                >
                  <span className="project-disclosure"><ChevronIcon /></span>
                  <FolderIcon />
                  <span>{project}</span>
                </button>
                {isExpanded && (
                  <div className="project-boards">
                    {projectBoards.map((board) => (
                      <BoardRow
                        key={`${project}-${board.id}`}
                        board={board}
                        active={board.id === activeBoardId}
                        onSelect={onSelectBoard}
                        onTogglePin={onTogglePin}
                        onSetArchived={onSetArchived}
                        onRequestDelete={setDeleteCandidate}
                        canDelete={boards.length > 1}
                        nested
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </SidebarSection>

        {recentBoards.length > 0 && (
          <SidebarSection title="Recents">
            {recentBoards.map((board) => (
              <BoardRow
                key={`recent-${board.id}`}
                board={board}
                active={board.id === activeBoardId}
                onSelect={onSelectBoard}
                onTogglePin={onTogglePin}
                onSetArchived={onSetArchived}
                onRequestDelete={setDeleteCandidate}
                canDelete={boards.length > 1}
              />
            ))}
          </SidebarSection>
        )}

        {archivedBoards.length > 0 && (
          <SidebarSection
            title={`Archived · ${archivedBoards.length}`}
            action={(
              <button
                className="archive-toggle"
                type="button"
                aria-label={`${archivedExpanded ? "Hide" : "Show"} archived Boards`}
                aria-expanded={archivedExpanded}
                onClick={() => setArchivedExpanded((current) => !current)}
              >
                <ChevronIcon />
              </button>
            )}
          >
            {archivedExpanded && archivedBoards.map((board) => (
              <BoardRow
                key={`archived-${board.id}`}
                board={board}
                active={board.id === activeBoardId}
                onSelect={onSelectBoard}
                onTogglePin={onTogglePin}
                onSetArchived={onSetArchived}
                onRequestDelete={setDeleteCandidate}
                canDelete={boards.length > 1}
              />
            ))}
          </SidebarSection>
        )}
      </nav>

      <button className="sidebar-account" type="button">
        <span className="sidebar-avatar">N</span>
        <span className="sidebar-account-copy">
          <strong>Nathan</strong>
          <small>Personal workspace</small>
        </span>
        <MoreIcon />
      </button>

      {deleteCandidate && (
        <div className="sidebar-dialog-backdrop" onPointerDown={() => setDeleteCandidate(null)}>
          <div
            className="sidebar-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-board-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="sidebar-dialog-mark" aria-hidden="true" />
            <h2 id="delete-board-title">Delete this Board?</h2>
            <p><strong>{deleteCandidate.title}</strong> and all of its canvas material will be permanently removed.</p>
            <div className="sidebar-dialog-actions">
              <button type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
              <button
                className="is-destructive"
                type="button"
                onClick={() => {
                  const boardId = deleteCandidate.id;
                  setDeleteCandidate(null);
                  void onDeleteBoard(boardId);
                }}
              >
                Delete Board
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="sidebar-section">
      <div className="sidebar-section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="sidebar-section-content">{children}</div>
    </section>
  );
}

function BoardRow({
  board,
  active,
  nested = false,
  onSelect,
  onTogglePin,
  onSetArchived,
  onRequestDelete,
  canDelete,
}: {
  board: BoardSummary;
  active: boolean;
  nested?: boolean;
  onSelect: (boardId: string) => void;
  onTogglePin: (boardId: string) => void;
  onSetArchived: (boardId: string, archived: boolean) => void | Promise<void>;
  onRequestDelete: (board: BoardSummary) => void;
  canDelete: boolean;
}) {
  return (
    <div
      className={`board-row-shell${active ? " is-active" : ""}${nested ? " is-nested" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="board-row"
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect(board.id)}
      >
        <BoardIcon />
        <span>{board.title}</span>
      </button>
      <div className="board-row-actions">
        {!board.archived ? (
          <>
          <button
            className={`pin-board-button${board.pinned ? " is-pinned" : ""}`}
            type="button"
            aria-label={`${board.pinned ? "Unpin" : "Pin"} ${board.title}`}
            aria-pressed={Boolean(board.pinned)}
            onClick={() => onTogglePin(board.id)}
          >
            <PinIcon />
          </button>
          <button
            className="archive-board-button"
            type="button"
            aria-label={`Archive ${board.title}`}
            title="Archive"
            onClick={() => void onSetArchived(board.id, true)}
          >
            <ArchiveIcon restored={false} />
          </button>
          </>
        ) : (
          <>
            <button
              className="archive-board-button"
              type="button"
              aria-label={`Restore ${board.title}`}
              title="Restore to sidebar"
              onClick={() => void onSetArchived(board.id, false)}
            >
              <ArchiveIcon restored />
            </button>
            <button
              className="delete-board-button"
              type="button"
              aria-label={`Delete ${board.title}`}
              title={canDelete ? "Delete permanently" : "A workspace must keep at least one Board"}
              disabled={!canDelete}
              onClick={() => onRequestDelete(board)}
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function SidebarOpenIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.75" y="3.25" width="14.5" height="13.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7.2 3.8v12.4" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

function SidebarCloseIcon() {
  return <SidebarOpenIcon />;
}

function NewBoardIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 3.4h7.2l3.8 3.8v8.9H4z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M11.2 3.6v3.8h3.6M7 11h5M9.5 8.5v5" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.7" cy="8.7" r="4.7" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="m12.3 12.3 3.4 3.4" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.5" y="4" width="13" height="12" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6.5 7.2h4.8M6.5 10h7M6.5 12.8h3.7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.8 6.2h5l1.5 1.7h7.9v6.7a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.8 7V5.4a1.8 1.8 0 0 1 1.8-1.8h3l1.6 1.8h6.2A1.8 1.8 0 0 1 17.2 7v.9" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="m4 5.5 3 3 3-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="5" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function ArchiveIcon({ restored }: { restored: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.4 5.4h13.2v10.2H3.4zM2.7 3.3h14.6v2.5H2.7z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {restored
        ? <path d="M7 11.7 10 8.8l3 2.9M10 9v4.2" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M7 9.2 10 12l3-2.8M10 7.8V12" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.2 6.1h9.6l-.6 10H5.8zM7.7 6.1V3.8h4.6v2.3M3.8 6.1h12.4M8.1 9v4.3M11.9 9v4.3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.1 2.8h5.8c.48 0 .77.52.52.93l-.92 1.5v3.05l2.1 2.18c.35.37.09.98-.42.98h-3.43v5.08a.75.75 0 0 1-1.5 0v-5.08H5.82c-.51 0-.77-.61-.42-.98l2.1-2.18V5.23l-.92-1.5a.61.61 0 0 1 .52-.93Z" fill="currentColor" />
    </svg>
  );
}
