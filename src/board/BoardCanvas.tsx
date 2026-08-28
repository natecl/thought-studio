import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { BoardToolbar, type CanvasTool } from "./BoardToolbar";
import { useBoardHistory } from "./useBoardHistory";
import type { BoardItem, BoardItemType, Camera } from "./types";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

interface ContextMenuState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
}

interface PanGesture {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: Camera;
}

interface ItemDragGesture {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  before: BoardItem[];
  moved: boolean;
}

interface BoardCanvasProps {
  boardId: string;
  title: string;
}

export function BoardCanvas({ boardId, title }: BoardCanvasProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const panRef = useRef<PanGesture | null>(null);
  const itemDragRef = useRef<ItemDragGesture | null>(null);
  const { items, commit, replace, checkpoint, undo, redo, canUndo, canRedo } = useBoardHistory(boardId);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [announcement, setAnnouncement] = useState("Empty board");

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - camera.x) / camera.scale,
        y: (clientY - rect.top - camera.y) / camera.scale,
      };
    },
    [camera],
  );

  const createItem = useCallback(
    (type: BoardItemType, point: { x: number; y: number }) => {
      const id = crypto.randomUUID();
      const item: BoardItem = {
        id,
        type,
        x: type === "note" ? point.x - 110 : point.x,
        y: type === "note" ? point.y - 82 : point.y,
        text: "",
      };

      commit([...items, item]);
      setSelectedId(id);
      setEditingId(id);
      setDraftText("");
      setContextMenu(null);
      setAnnouncement(type === "note" ? "Note added" : "Text added");
    },
    [commit, items],
  );

  const createAtViewportCenter = useCallback(
    (type: BoardItemType) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      createItem(type, screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2));
    },
    [createItem, screenToWorld],
  );

  const beginEditing = useCallback((item: BoardItem) => {
    setSelectedId(item.id);
    setEditingId(item.id);
    setDraftText(item.text);
  }, []);

  const finishEditing = useCallback(() => {
    if (!editingId) return;
    const item = items.find((candidate) => candidate.id === editingId);
    if (!item) {
      setEditingId(null);
      return;
    }

    if (!draftText.trim()) {
      commit(items.filter((candidate) => candidate.id !== editingId));
      setSelectedId(null);
      setAnnouncement("Empty item removed");
    } else if (draftText !== item.text) {
      commit(items.map((candidate) => (candidate.id === editingId ? { ...candidate, text: draftText } : candidate)));
      setAnnouncement("Item updated");
    }

    setEditingId(null);
  }, [commit, draftText, editingId, items]);

  const cancelEditing = useCallback(() => {
    if (!editingId) return;
    const item = items.find((candidate) => candidate.id === editingId);
    if (item && !item.text) {
      commit(items.filter((candidate) => candidate.id !== editingId));
      setSelectedId(null);
    }
    setEditingId(null);
    setDraftText("");
  }, [commit, editingId, items]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
    setAnnouncement("Item deleted");
  }, [commit, items, selectedId]);

  const nudgeSelected = useCallback(
    (x: number, y: number) => {
      if (!selectedId) return;
      commit(items.map((item) => (item.id === selectedId ? { ...item, x: item.x + x, y: item.y + y } : item)));
      setAnnouncement("Item moved");
    },
    [commit, items, selectedId],
  );

  const zoomAtViewportCenter = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCamera((current) => {
      const pointerX = rect.width / 2;
      const pointerY = rect.height / 2;
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      return {
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale,
        scale: nextScale,
      };
    });
  }, []);

  useEffect(() => {
    if (!editingId) return;
    const frame = requestAnimationFrame(() => {
      const editor = viewportRef.current?.querySelector<HTMLTextAreaElement>(`[data-editor-id="${editingId}"]`);
      editor?.focus();
      editor?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setContextMenu(null);
        if (editingId) cancelEditing();
        else setSelectedId(null);
        return;
      }

      if (isTyping) return;

      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
          setAnnouncement("Redone");
        } else {
          undo();
          setAnnouncement("Undone");
        }
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }

      if (!command && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setActiveTool("select");
        setAnnouncement("Select tool active");
        return;
      }

      if (!command && event.key.toLowerCase() === "h") {
        event.preventDefault();
        setActiveTool("hand");
        setAnnouncement("Pan tool active");
        return;
      }

      if (!command && event.key.toLowerCase() === "t") {
        event.preventDefault();
        createAtViewportCenter("text");
        return;
      }

      if (!command && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createAtViewportCenter("note");
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomAtViewportCenter(1.12);
        setAnnouncement("Zoomed in");
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        zoomAtViewportCenter(1 / 1.12);
        setAnnouncement("Zoomed out");
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setCamera(DEFAULT_CAMERA);
        setAnnouncement("View reset");
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if (event.key === "Enter" && selectedId) {
        const item = items.find((candidate) => candidate.id === selectedId);
        if (item) beginEditing(item);
        return;
      }

      if (selectedId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowLeft") nudgeSelected(-amount, 0);
        if (event.key === "ArrowRight") nudgeSelected(amount, 0);
        if (event.key === "ArrowUp") nudgeSelected(0, -amount);
        if (event.key === "ArrowDown") nudgeSelected(0, amount);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpacePressed(false);
        setIsPanning(false);
        panRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    activeTool,
    beginEditing,
    cancelEditing,
    createAtViewportCenter,
    deleteSelected,
    editingId,
    items,
    nudgeSelected,
    redo,
    selectedId,
    undo,
    zoomAtViewportCenter,
  ]);

  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    setContextMenu(null);

    if (event.ctrlKey || event.metaKey) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - camera.x) / camera.scale;
      const worldY = (pointerY - camera.y) / camera.scale;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * Math.exp(-event.deltaY * 0.002)));

      setCamera({
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale,
        scale: nextScale,
      });
      return;
    }

    setCamera((current) => ({
      ...current,
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    }));
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    setContextMenu(null);
    const isPanGesture = event.button === 1 || (event.button === 0 && (spacePressed || activeTool === "hand"));

    if (isPanGesture) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: camera,
      };
      setIsPanning(true);
      return;
    }

    if (event.button === 0 && event.target === event.currentTarget) {
      setSelectedId(null);
      if (editingId) finishEditing();
    }
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setCamera({
      ...pan.startCamera,
      x: pan.startCamera.x + event.clientX - pan.startClientX,
      y: pan.startCamera.y + event.clientY - pan.startClientY,
    });
  };

  const finishPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
  };

  const handleContextMenu = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = screenToWorld(event.clientX, event.clientY);
    setContextMenu({
      screenX: Math.min(event.clientX - rect.left, rect.width - 210),
      screenY: Math.min(event.clientY - rect.top, rect.height - 220),
      worldX: point.x,
      worldY: point.y,
    });
  };

  const beginItemDrag = (event: ReactPointerEvent<HTMLDivElement>, item: BoardItem) => {
    if (event.button !== 0 || editingId === item.id || activeTool === "hand") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    setContextMenu(null);
    itemDragRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: item.x,
      originY: item.y,
      before: items,
      moved: false,
    };
  };

  const moveItem = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = itemDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - drag.startClientX) / camera.scale;
    const deltaY = (event.clientY - drag.startClientY) / camera.scale;
    drag.moved = drag.moved || Math.abs(deltaX) + Math.abs(deltaY) > 1;
    replace(
      drag.before.map((item) =>
        item.id === drag.id ? { ...item, x: drag.originX + deltaX, y: drag.originY + deltaY } : item,
      ),
    );
  };

  const finishItemDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = itemDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      checkpoint(drag.before);
      setAnnouncement("Item moved");
    }
    itemDragRef.current = null;
  };

  return (
    <section
      ref={viewportRef}
      className={`board-viewport is-${activeTool}-tool${spacePressed ? " is-space-ready" : ""}${isPanning ? " is-panning" : ""}`}
      aria-label={`${title} canvas`}
      tabIndex={0}
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={finishPan}
      onPointerCancel={finishPan}
      onDoubleClick={(event) => {
        if (event.target !== event.currentTarget || activeTool === "hand") return;
        createItem("text", screenToWorld(event.clientX, event.clientY));
      }}
      onContextMenu={handleContextMenu}
    >
      <div
        className="canvas-field"
        aria-hidden="true"
        style={{
          backgroundPosition: `${camera.x + 1}px ${camera.y + 1}px`,
          backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`,
        }}
      />

      <div
        className="canvas-world"
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
      >
        {items.map((item) => {
          const selected = selectedId === item.id;
          const editing = editingId === item.id;
          return (
            <div
              key={item.id}
              data-board-item
              className={`board-object ${item.type}-object${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}`}
              style={{ transform: `translate(${item.x}px, ${item.y}px)` }}
              role="group"
              aria-label={`${item.type}: ${item.text || "Empty"}`}
              tabIndex={editing ? -1 : 0}
              onPointerDown={(event) => beginItemDrag(event, item)}
              onPointerMove={moveItem}
              onPointerUp={finishItemDrag}
              onPointerCancel={finishItemDrag}
              onDoubleClick={(event) => {
                event.stopPropagation();
                beginEditing(item);
              }}
              onFocus={() => setSelectedId(item.id)}
            >
              {editing ? (
                <textarea
                  data-editor-id={item.id}
                  className="object-editor"
                  value={draftText}
                  aria-label={`Edit ${item.type}`}
                  placeholder={item.type === "note" ? "Write a note…" : "Start typing…"}
                  onChange={(event) => setDraftText(event.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEditing();
                    }
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      finishEditing();
                    }
                  }}
                />
              ) : (
                <div className="object-surface">{item.text}</div>
              )}
            </div>
          );
        })}
      </div>

      <BoardToolbar
        activeTool={activeTool}
        canUndo={canUndo}
        canRedo={canRedo}
        zoomPercent={Math.round(camera.scale * 100)}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          setAnnouncement(tool === "hand" ? "Pan tool active" : "Select tool active");
        }}
        onAddText={() => {
          setActiveTool("select");
          createAtViewportCenter("text");
        }}
        onAddNote={() => {
          setActiveTool("select");
          createAtViewportCenter("note");
        }}
        onUndo={() => {
          undo();
          setAnnouncement("Undone");
        }}
        onRedo={() => {
          redo();
          setAnnouncement("Redone");
        }}
        onZoomOut={() => {
          zoomAtViewportCenter(1 / 1.12);
          setAnnouncement("Zoomed out");
        }}
        onResetView={() => {
          setCamera(DEFAULT_CAMERA);
          setAnnouncement("View reset");
        }}
        onZoomIn={() => {
          zoomAtViewportCenter(1.12);
          setAnnouncement("Zoomed in");
        }}
      />

      {contextMenu && (
        <div
          className="canvas-context-menu"
          role="menu"
          aria-label="Canvas actions"
          style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => createItem("text", { x: contextMenu.worldX, y: contextMenu.worldY })}
          >
            <span>Add text</span>
            <kbd>T</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => createItem("note", { x: contextMenu.worldX, y: contextMenu.worldY })}
          >
            <span>Add note</span>
            <kbd>N</kbd>
          </button>
          <div className="context-divider" />
          <button
            type="button"
            role="menuitem"
            disabled={!canUndo}
            onClick={() => {
              undo();
              setContextMenu(null);
              setAnnouncement("Undone");
            }}
          >
            <span>Undo</span>
            <kbd>⌘Z</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canRedo}
            onClick={() => {
              redo();
              setContextMenu(null);
              setAnnouncement("Redone");
            }}
          >
            <span>Redo</span>
            <kbd>⇧⌘Z</kbd>
          </button>
          <div className="context-divider" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCamera(DEFAULT_CAMERA);
              setContextMenu(null);
              setAnnouncement("View reset");
            }}
          >
            <span>Reset view</span>
            <kbd>100%</kbd>
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
