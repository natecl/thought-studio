import type { ReactNode } from "react";

export type CanvasTool = "select" | "hand" | "lasso" | "frame";

interface BoardToolbarProps {
  activeTool: CanvasTool;
  canRedo: boolean;
  canUndo: boolean;
  zoomPercent: number;
  onAddNote: () => void;
  onAddFrame: () => void;
  onAddText: () => void;
  onRedo: () => void;
  onResetView: () => void;
  onSelectTool: (tool: CanvasTool) => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function BoardToolbar({
  activeTool,
  canRedo,
  canUndo,
  zoomPercent,
  onAddFrame,
  onAddNote,
  onAddText,
  onRedo,
  onResetView,
  onSelectTool,
  onUndo,
  onZoomIn,
  onZoomOut,
}: BoardToolbarProps) {
  return (
    <div className="board-toolbar" role="toolbar" aria-label="Board tools" onPointerDown={(event) => event.stopPropagation()}>
      <ToolButton
        label="Select"
        shortcut="V"
        active={activeTool === "select"}
        onClick={() => onSelectTool("select")}
      >
        <SelectIcon />
      </ToolButton>
      <ToolButton
        label="Pan"
        shortcut="H"
        active={activeTool === "hand"}
        onClick={() => onSelectTool("hand")}
      >
        <HandIcon />
      </ToolButton>
      <ToolButton
        label="Lasso"
        shortcut="L"
        active={activeTool === "lasso"}
        onClick={() => onSelectTool("lasso")}
      >
        <LassoIcon />
      </ToolButton>

      <span className="toolbar-divider" aria-hidden="true" />

      <ToolButton label="Add text" shortcut="T" onClick={onAddText}>
        <TextIcon />
      </ToolButton>
      <ToolButton label="Add note" shortcut="N" onClick={onAddNote}>
        <NoteIcon />
      </ToolButton>
      <ToolButton label="Add frame" shortcut="F" active={activeTool === "frame"} onClick={onAddFrame}>
        <FrameIcon />
      </ToolButton>

      <span className="toolbar-divider" aria-hidden="true" />

      <ToolButton label="Undo" shortcut="⌘Z" disabled={!canUndo} onClick={onUndo}>
        <UndoIcon />
      </ToolButton>
      <ToolButton label="Redo" shortcut="⇧⌘Z" disabled={!canRedo} onClick={onRedo}>
        <RedoIcon />
      </ToolButton>

      <span className="toolbar-divider board-toolbar-view" aria-hidden="true" />

      <div className="board-toolbar-view">
        <ToolButton label="Zoom out" shortcut="−" onClick={onZoomOut}>
          <MinusIcon />
        </ToolButton>
        <button className="zoom-reset-button" type="button" onClick={onResetView} aria-label="Reset view">
          {zoomPercent}%
        </button>
        <ToolButton label="Zoom in" shortcut="+" onClick={onZoomIn}>
          <PlusIcon />
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`board-tool-button${active ? " is-active" : ""}`}
      type="button"
      aria-label={`${label} (${shortcut})`}
      aria-pressed={active || undefined}
      disabled={disabled}
      data-tooltip={`${label}  ${shortcut}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SelectIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3.2 14.4 11l-4.6.8-2.3 4.1z" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.1 9.2V5.4a1.2 1.2 0 0 1 2.4 0v2.8-4a1.2 1.2 0 0 1 2.4 0v4-3a1.2 1.2 0 0 1 2.4 0v3.7-2a1.2 1.2 0 0 1 2.4 0v4.7c0 3.2-2.1 5.2-5.2 5.2H9.3c-1.8 0-3-.7-4.1-2L2.9 11a1.3 1.3 0 0 1 2-1.6z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LassoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M15.8 9.2c0 3-2.7 5.1-6.3 5.1-3.4 0-5.8-1.7-5.8-4.3 0-2.8 2.8-4.7 6.4-4.7 3.2 0 5.7 1.5 5.7 3.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M15.8 9.2c0 3.9-1.2 6.6-3.2 6.6-1.1 0-1.8-.7-1.8-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4.7h12M10 4.7v10.6M7.6 15.3h4.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 3.7h12v9.5L12.7 16H4z" fill="var(--sun)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12.7 16v-2.8H16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.4" y="5.2" width="13.2" height="11.1" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.7 5.2V3.7h5.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7.2 6.2-3 3 3 3M4.5 9.2h6.1c3 0 4.8 1.5 4.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m12.8 6.2 3 3-3 3M15.5 9.2H9.4c-3 0-4.8 1.5-4.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinusIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M10 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
