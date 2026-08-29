import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { BoardToolbar, type CanvasTool } from "./BoardToolbar";
import { useBoardHistory } from "./useBoardHistory";
import type { BoardFrame, BoardItem, BoardObjectType, Camera } from "./types";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: 1 };
const DEFAULT_FRAME_SIZE = { width: 520, height: 320 };
const MIN_FRAME_SIZE = { width: 180, height: 120 };
const FRAME_HORIZONTAL_PADDING = 30;
const FRAME_TOP_PADDING = 48;
const FRAME_BOTTOM_PADDING = 30;

interface Point { x: number; y: number }
interface ScreenRect { left: number; top: number; right: number; bottom: number; width: number; height: number }
interface ContextMenuState { screenX: number; screenY: number; worldX: number; worldY: number }
interface PanGesture { pointerId: number; startClientX: number; startClientY: number; startCamera: Camera }
interface ItemDragGesture {
  ids: Set<string>;
  directIds: Set<string>;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  before: BoardItem[];
  moved: boolean;
}
interface SelectionGesture {
  pointerId: number;
  mode: "marquee" | "lasso";
  base: Set<string>;
  start: Point;
  points: Point[];
  moved: boolean;
}
interface SelectionDraft { mode: "marquee" | "lasso"; start: Point; current: Point; points: Point[] }
interface FramePlacementGesture { pointerId: number; start: Point; current: Point; moved: boolean }
type FrameResizeHandle = "north-west" | "north" | "north-east" | "east" | "south-east" | "south" | "south-west" | "west";
interface FrameResizeGesture {
  pointerId: number;
  frameId: string;
  handle: FrameResizeHandle;
  startClientX: number;
  startClientY: number;
  initial: Pick<BoardFrame, "x" | "y" | "width" | "height">;
  before: BoardItem[];
  moved: boolean;
}
interface BoardCanvasProps { boardId: string; title: string }

const FRAME_RESIZE_HANDLES: FrameResizeHandle[] = [
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
];

function setsMatch(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function rectangleFromPoints(start: Point, end: Point): ScreenRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function constrainedRectangleFromPoints(start: Point, end: Point): ScreenRect {
  const width = Math.max(MIN_FRAME_SIZE.width, Math.abs(end.x - start.x));
  const height = Math.max(MIN_FRAME_SIZE.height, Math.abs(end.y - start.y));
  const left = end.x >= start.x ? start.x : start.x - width;
  const top = end.y >= start.y ? start.y : start.y - height;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function assignChildrenToFrame(items: BoardItem[], frameId: string, childIds: string[]) {
  const assignedIds = new Set(childIds);
  return items.map((item) => {
    if (item.type !== "frame") return item;
    if (item.id === frameId) return { ...item, childIds };
    return { ...item, childIds: item.childIds.filter((id) => !assignedIds.has(id)) };
  });
}

function rectanglesIntersect(left: ScreenRect, right: ScreenRect) {
  return left.left <= right.right && left.right >= right.left && left.top <= right.bottom && left.bottom >= right.top;
}

function pointInsidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function BoardCanvas({ boardId, title }: BoardCanvasProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const panRef = useRef<PanGesture | null>(null);
  const itemDragRef = useRef<ItemDragGesture | null>(null);
  const selectionGestureRef = useRef<SelectionGesture | null>(null);
  const framePlacementRef = useRef<FramePlacementGesture | null>(null);
  const frameResizeRef = useRef<FrameResizeGesture | null>(null);
  const { items, commit, replace, checkpoint, undo, redo, canUndo, canRedo } = useBoardHistory(boardId);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [framePlacementDraft, setFramePlacementDraft] = useState<FramePlacementGesture | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<ScreenRect | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [announcement, setAnnouncement] = useState("Empty board");

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - camera.x) / camera.scale,
      y: (clientY - rect.top - camera.y) / camera.scale,
    };
  }, [camera]);

  const clientToViewport = useCallback((clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const readItemRects = useCallback(() => {
    const viewport = viewportRef.current;
    const viewportRect = viewport?.getBoundingClientRect();
    if (!viewport || !viewportRect) return new Map<string, ScreenRect>();
    const result = new Map<string, ScreenRect>();
    viewport.querySelectorAll<HTMLElement>("[data-board-item-id]").forEach((element) => {
      const id = element.dataset.boardItemId;
      if (!id) return;
      const rect = element.getBoundingClientRect();
      result.set(id, {
        left: rect.left - viewportRect.left,
        top: rect.top - viewportRect.top,
        right: rect.right - viewportRect.left,
        bottom: rect.bottom - viewportRect.top,
        width: rect.width,
        height: rect.height,
      });
    });
    return result;
  }, []);

  const readObjectIdsInside = useCallback((bounds: ScreenRect) => {
    const itemRects = readItemRects();
    return items
      .filter((item) => item.type !== "frame")
      .filter((item) => {
        const rect = itemRects.get(item.id);
        if (!rect) return false;
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return center.x >= bounds.left && center.x <= bounds.right && center.y >= bounds.top && center.y <= bounds.bottom;
      })
      .map((item) => item.id);
  }, [items, readItemRects]);

  const createItem = useCallback((type: BoardObjectType, point: Point) => {
    const id = crypto.randomUUID();
    const item: BoardItem = {
      id,
      type,
      x: type === "note" ? point.x - 110 : point.x,
      y: type === "note" ? point.y - 82 : point.y,
      text: "",
    };
    commit([...items, item]);
    setSelectedIds(new Set([id]));
    setEditingId(id);
    setDraftText("");
    setContextMenu(null);
    setAnnouncement(type === "note" ? "Note added" : "Text added");
  }, [commit, items]);

  const createAtViewportCenter = useCallback((type: BoardObjectType) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    createItem(type, screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }, [createItem, screenToWorld]);

  const createEmptyFrameAt = useCallback((point: Point) => {
    const frame: BoardFrame = {
      id: crypto.randomUUID(),
      type: "frame",
      x: point.x - DEFAULT_FRAME_SIZE.width / 2,
      y: point.y - DEFAULT_FRAME_SIZE.height / 2,
      text: "Untitled frame",
      width: DEFAULT_FRAME_SIZE.width,
      height: DEFAULT_FRAME_SIZE.height,
      childIds: [],
    };
    commit([...items, frame]);
    setSelectedIds(new Set([frame.id]));
    setActiveTool("select");
    setContextMenu(null);
    setAnnouncement("Frame added");
  }, [commit, items]);

  const createFrameFromViewportRect = useCallback((bounds: ScreenRect) => {
    const childIds = readObjectIdsInside(bounds);
    const frame: BoardFrame = {
      id: crypto.randomUUID(),
      type: "frame",
      x: (bounds.left - camera.x) / camera.scale,
      y: (bounds.top - camera.y) / camera.scale,
      text: "Untitled frame",
      width: bounds.width / camera.scale,
      height: bounds.height / camera.scale,
      childIds,
    };
    const nextItems = assignChildrenToFrame([...items, frame], frame.id, childIds);
    commit(nextItems);
    setSelectedIds(new Set([frame.id]));
    setActiveTool("select");
    setContextMenu(null);
    setAnnouncement(childIds.length > 0
      ? `Frame placed around ${childIds.length} ${childIds.length === 1 ? "Object" : "Objects"}`
      : "Frame placed");
  }, [camera, commit, items, readObjectIdsInside]);

  const createFrameFromSelection = useCallback(() => {
    const childIds = [...selectedIds].filter((id) => items.some((item) => item.id === id && item.type !== "frame"));
    if (childIds.length === 0) {
      setActiveTool("frame");
      setAnnouncement("Frame tool active. Drag to draw a context boundary");
      return;
    }

    const selectedRects = [...readItemRects()].filter(([id]) => childIds.includes(id)).map(([, rect]) => rect);
    if (selectedRects.length === 0) return;
    const left = Math.min(...selectedRects.map((rect) => rect.left));
    const top = Math.min(...selectedRects.map((rect) => rect.top));
    const right = Math.max(...selectedRects.map((rect) => rect.right));
    const bottom = Math.max(...selectedRects.map((rect) => rect.bottom));
    const frame: BoardFrame = {
      id: crypto.randomUUID(),
      type: "frame",
      x: (left - camera.x) / camera.scale - FRAME_HORIZONTAL_PADDING,
      y: (top - camera.y) / camera.scale - FRAME_TOP_PADDING,
      text: "Untitled frame",
      width: Math.max(240, (right - left) / camera.scale + FRAME_HORIZONTAL_PADDING * 2),
      height: Math.max(160, (bottom - top) / camera.scale + FRAME_TOP_PADDING + FRAME_BOTTOM_PADDING),
      childIds,
    };
    const childIdSet = new Set(childIds);
    const nextItems = items.map((item) =>
      item.type === "frame" ? { ...item, childIds: item.childIds.filter((id) => !childIdSet.has(id)) } : item,
    );
    commit([...nextItems, frame]);
    setSelectedIds(new Set([frame.id]));
    setActiveTool("select");
    setContextMenu(null);
    setAnnouncement(`Frame created around ${childIds.length} ${childIds.length === 1 ? "Object" : "Objects"}`);
  }, [camera, commit, items, readItemRects, selectedIds]);

  const beginEditing = useCallback((item: BoardItem) => {
    setSelectedIds(new Set([item.id]));
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
    if (!draftText.trim() && item.type === "frame") {
      commit(items.map((candidate) => candidate.id === editingId ? { ...candidate, text: "Untitled frame" } : candidate));
      setAnnouncement("Frame title reset");
    } else if (!draftText.trim()) {
      commit(
        items
          .filter((candidate) => candidate.id !== editingId)
          .map((candidate) => candidate.type === "frame"
            ? { ...candidate, childIds: candidate.childIds.filter((id) => id !== editingId) }
            : candidate),
      );
      setSelectedIds(new Set());
      setAnnouncement("Empty Object removed");
    } else if (draftText !== item.text) {
      commit(items.map((candidate) => candidate.id === editingId ? { ...candidate, text: draftText } : candidate));
      setAnnouncement(item.type === "frame" ? "Frame title updated" : "Object updated");
    }
    setEditingId(null);
  }, [commit, draftText, editingId, items]);

  const cancelEditing = useCallback(() => {
    if (!editingId) return;
    const item = items.find((candidate) => candidate.id === editingId);
    if (item && item.type !== "frame" && !item.text) {
      commit(items.filter((candidate) => candidate.id !== editingId));
      setSelectedIds(new Set());
    }
    setEditingId(null);
    setDraftText("");
  }, [commit, editingId, items]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    commit(
      items
        .filter((item) => !selectedIds.has(item.id))
        .map((item) => item.type === "frame"
          ? { ...item, childIds: item.childIds.filter((id) => !selectedIds.has(id)) }
          : item),
    );
    setSelectedIds(new Set());
    setEditingId(null);
    setAnnouncement(count === 1 && selectedItems[0]?.type === "frame" ? "Frame removed; contained Objects preserved" : `${count} ${count === 1 ? "Object" : "Objects"} deleted`);
  }, [commit, items, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const idsToClone = new Set(selectedIds);
    items.forEach((item) => {
      if (item.type === "frame" && selectedIds.has(item.id)) item.childIds.forEach((id) => idsToClone.add(id));
    });
    const idMap = new Map([...idsToClone].map((id) => [id, crypto.randomUUID()]));
    const clones = items.filter((item) => idsToClone.has(item.id)).map((item): BoardItem => {
      return item.type === "frame"
        ? { ...item, id: idMap.get(item.id)!, x: item.x + 24, y: item.y + 24, childIds: item.childIds.map((id) => idMap.get(id) ?? id) }
        : { ...item, id: idMap.get(item.id)!, x: item.x + 24, y: item.y + 24 };
    });
    commit([...items, ...clones]);
    setSelectedIds(new Set([...selectedIds].map((id) => idMap.get(id)!).filter(Boolean)));
    const selectedFrameCount = items.filter((item) => item.type === "frame" && selectedIds.has(item.id)).length;
    setAnnouncement(selectedFrameCount > 0 ? `${selectedFrameCount === 1 ? "Frame" : `${selectedFrameCount} Frames`} and contained Objects duplicated` : `${clones.length} ${clones.length === 1 ? "Object" : "Objects"} duplicated`);
  }, [commit, items, selectedIds]);

  const expandFrameSelection = useCallback((selection: Set<string>) => {
    const expanded = new Set(selection);
    items.forEach((item) => {
      if (item.type === "frame" && selection.has(item.id)) item.childIds.forEach((id) => expanded.add(id));
    });
    return expanded;
  }, [items]);

  const nudgeSelected = useCallback((x: number, y: number) => {
    if (selectedIds.size === 0) return;
    const movementIds = expandFrameSelection(selectedIds);
    commit(items.map((item) => movementIds.has(item.id) ? { ...item, x: item.x + x, y: item.y + y } : item));
    setAnnouncement(`${selectedIds.size} ${selectedIds.size === 1 ? "Object" : "Objects"} moved`);
  }, [commit, expandFrameSelection, items, selectedIds]);

  const beginFrameResize = (event: ReactPointerEvent<HTMLButtonElement>, frame: BoardFrame, handle: FrameResizeHandle) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    viewportRef.current?.setPointerCapture(event.pointerId);
    setSelectedIds(new Set([frame.id]));
    frameResizeRef.current = {
      pointerId: event.pointerId,
      frameId: frame.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      before: items,
      moved: false,
    };
  };

  const moveFrameResize = (clientX: number, clientY: number) => {
    const gesture = frameResizeRef.current;
    if (!gesture) return;
    const deltaX = (clientX - gesture.startClientX) / camera.scale;
    const deltaY = (clientY - gesture.startClientY) / camera.scale;
    gesture.moved = gesture.moved || Math.abs(deltaX) + Math.abs(deltaY) > 1;

    const movesWest = gesture.handle.includes("west");
    const movesEast = gesture.handle.includes("east");
    const movesNorth = gesture.handle.includes("north");
    const movesSouth = gesture.handle.includes("south");
    let { x, y, width, height } = gesture.initial;
    const minWidth = MIN_FRAME_SIZE.width / camera.scale;
    const minHeight = MIN_FRAME_SIZE.height / camera.scale;

    if (movesWest) {
      width = Math.max(minWidth, gesture.initial.width - deltaX);
      x = gesture.initial.x + gesture.initial.width - width;
    } else if (movesEast) {
      width = Math.max(minWidth, gesture.initial.width + deltaX);
    }
    if (movesNorth) {
      height = Math.max(minHeight, gesture.initial.height - deltaY);
      y = gesture.initial.y + gesture.initial.height - height;
    } else if (movesSouth) {
      height = Math.max(minHeight, gesture.initial.height + deltaY);
    }

    replace(gesture.before.map((item) => item.id === gesture.frameId && item.type === "frame"
      ? { ...item, x, y, width, height }
      : item));
  };

  const finishFrameResize = (pointerId: number) => {
    const gesture = frameResizeRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    if (gesture.moved) {
      const frameRect = readItemRects().get(gesture.frameId);
      const childIds = frameRect ? readObjectIdsInside(frameRect) : [];
      replace(assignChildrenToFrame(items, gesture.frameId, childIds));
      checkpoint(gesture.before);
      setAnnouncement(`Frame resized around ${childIds.length} ${childIds.length === 1 ? "Object" : "Objects"}`);
    }
    frameResizeRef.current = null;
  };

  const zoomAtViewportCenter = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCamera((current) => {
      const pointerX = rect.width / 2;
      const pointerY = rect.height / 2;
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      return { x: pointerX - worldX * nextScale, y: pointerY - worldY * nextScale, scale: nextScale };
    });
  }, []);

  const selectWithinGesture = useCallback((gesture: SelectionGesture) => {
    const next = new Set(gesture.base);
    const itemRects = readItemRects();
    if (gesture.mode === "marquee") {
      const selectionRect = rectangleFromPoints(gesture.start, gesture.points.at(-1) ?? gesture.start);
      itemRects.forEach((rect, id) => {
        if (items.find((item) => item.id === id)?.type === "frame") return;
        if (rectanglesIntersect(selectionRect, rect)) next.add(id);
      });
    } else if (gesture.points.length >= 3) {
      itemRects.forEach((rect, id) => {
        if (items.find((item) => item.id === id)?.type === "frame") return;
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        if (pointInsidePolygon(center, gesture.points)) next.add(id);
      });
    }
    setSelectedIds(next);
  }, [items, readItemRects]);

  useEffect(() => {
    if (!editingId) return;
    const frame = requestAnimationFrame(() => {
      const editor = viewportRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-editor-id="${editingId}"]`);
      editor?.focus();
      editor?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    const validSelection = new Set([...selectedIds].filter((id) => validIds.has(id)));
    if (!setsMatch(validSelection, selectedIds)) setSelectedIds(validSelection);
  }, [items, selectedIds]);

  useLayoutEffect(() => {
    if (selectedIds.size < 2) {
      setSelectionBounds(null);
      return;
    }
    const measure = () => {
      const selectedRects = [...readItemRects()].filter(([id]) => selectedIds.has(id)).map(([, rect]) => rect);
      if (selectedRects.length < 2) {
        setSelectionBounds(null);
        return;
      }
      const left = Math.min(...selectedRects.map((rect) => rect.left));
      const top = Math.min(...selectedRects.map((rect) => rect.top));
      const right = Math.max(...selectedRects.map((rect) => rect.right));
      const bottom = Math.max(...selectedRects.map((rect) => rect.bottom));
      setSelectionBounds({ left, top, right, bottom, width: right - left, height: bottom - top });
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [camera, items, readItemRects, selectedIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement || target?.isContentEditable;
      if (event.key === "Escape") {
        setContextMenu(null);
        setSelectionDraft(null);
        selectionGestureRef.current = null;
        framePlacementRef.current = null;
        setFramePlacementDraft(null);
        if (activeTool === "frame") setActiveTool("select");
        if (editingId) cancelEditing();
        else setSelectedIds(new Set());
        return;
      }
      if (isTyping) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(new Set(items.map((item) => item.id)));
        setAnnouncement(`${items.length} ${items.length === 1 ? "Object" : "Objects"} selected`);
        return;
      }
      if (command && event.key.toLowerCase() === "d" && selectedIds.size > 0) {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) { redo(); setAnnouncement("Redone"); }
        else { undo(); setAnnouncement("Undone"); }
        return;
      }
      if (event.key === " ") { event.preventDefault(); setSpacePressed(true); return; }
      if (!command && event.key.toLowerCase() === "v") { event.preventDefault(); setActiveTool("select"); setAnnouncement("Select tool active"); return; }
      if (!command && event.key.toLowerCase() === "h") { event.preventDefault(); setActiveTool("hand"); setAnnouncement("Pan tool active"); return; }
      if (!command && event.key.toLowerCase() === "l") { event.preventDefault(); setActiveTool("lasso"); setAnnouncement("Lasso tool active"); return; }
      if (!command && event.key.toLowerCase() === "t") { event.preventDefault(); createAtViewportCenter("text"); return; }
      if (!command && event.key.toLowerCase() === "n") { event.preventDefault(); createAtViewportCenter("note"); return; }
      if (!command && event.key.toLowerCase() === "f") { event.preventDefault(); createFrameFromSelection(); return; }
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomAtViewportCenter(1.12); setAnnouncement("Zoomed in"); return; }
      if (event.key === "-") { event.preventDefault(); zoomAtViewportCenter(1 / 1.12); setAnnouncement("Zoomed out"); return; }
      if (event.key === "0") { event.preventDefault(); setCamera(DEFAULT_CAMERA); setAnnouncement("View reset"); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.size > 0) {
        event.preventDefault(); deleteSelected(); return;
      }
      if (event.key === "Enter" && selectedIds.size === 1) {
        const item = items.find((candidate) => candidate.id === [...selectedIds][0]);
        if (item) beginEditing(item);
        return;
      }
      if (selectedIds.size > 0 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowLeft") nudgeSelected(-amount, 0);
        if (event.key === "ArrowRight") nudgeSelected(amount, 0);
        if (event.key === "ArrowUp") nudgeSelected(0, -amount);
        if (event.key === "ArrowDown") nudgeSelected(0, amount);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") { setSpacePressed(false); setIsPanning(false); panRef.current = null; }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [activeTool, beginEditing, cancelEditing, createAtViewportCenter, createFrameFromSelection, deleteSelected, duplicateSelected, editingId, items, nudgeSelected, redo, selectedIds, undo, zoomAtViewportCenter]);

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
      setCamera({ x: pointerX - worldX * nextScale, y: pointerY - worldY * nextScale, scale: nextScale });
      return;
    }
    setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    setContextMenu(null);
    const target = event.target as Element;
    const isPanGesture = event.button === 1 || (event.button === 0 && (spacePressed || activeTool === "hand"));
    if (isPanGesture) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startCamera: camera };
      setIsPanning(true);
      return;
    }
    if (event.button !== 0 || target.closest("[data-board-item], .board-toolbar, .multi-selection-toolbar, .canvas-context-menu")) return;
    if (editingId) finishEditing();
    const point = clientToViewport(event.clientX, event.clientY);
    if (activeTool === "frame") {
      const gesture: FramePlacementGesture = { pointerId: event.pointerId, start: point, current: point, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      framePlacementRef.current = gesture;
      setFramePlacementDraft(gesture);
      setSelectedIds(new Set());
      return;
    }
    const mode = activeTool === "lasso" ? "lasso" : "marquee";
    const base = event.shiftKey ? new Set(selectedIds) : new Set<string>();
    const gesture: SelectionGesture = { pointerId: event.pointerId, mode, base, start: point, points: [point], moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectionGestureRef.current = gesture;
    setSelectionDraft({ mode, start: point, current: point, points: [point] });
    setSelectedIds(base);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (frameResizeRef.current?.pointerId === event.pointerId) {
      moveFrameResize(event.clientX, event.clientY);
      return;
    }
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      setCamera({ ...pan.startCamera, x: pan.startCamera.x + event.clientX - pan.startClientX, y: pan.startCamera.y + event.clientY - pan.startClientY });
      return;
    }
    const framePlacement = framePlacementRef.current;
    if (framePlacement?.pointerId === event.pointerId) {
      const point = clientToViewport(event.clientX, event.clientY);
      framePlacement.current = point;
      framePlacement.moved = framePlacement.moved || Math.hypot(point.x - framePlacement.start.x, point.y - framePlacement.start.y) > 3;
      setFramePlacementDraft({ ...framePlacement });
      return;
    }
    const selection = selectionGestureRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    const point = clientToViewport(event.clientX, event.clientY);
    selection.moved = selection.moved || Math.hypot(point.x - selection.start.x, point.y - selection.start.y) > 3;
    selection.points = selection.mode === "lasso" ? [...selection.points, point] : [selection.start, point];
    setSelectionDraft({ mode: selection.mode, start: selection.start, current: point, points: selection.points });
    selectWithinGesture(selection);
  };

  const finishViewportGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (frameResizeRef.current?.pointerId === event.pointerId) { finishFrameResize(event.pointerId); return; }
    if (panRef.current?.pointerId === event.pointerId) { panRef.current = null; setIsPanning(false); return; }
    const framePlacement = framePlacementRef.current;
    if (framePlacement?.pointerId === event.pointerId) {
      if (framePlacement.moved) createFrameFromViewportRect(constrainedRectangleFromPoints(framePlacement.start, framePlacement.current));
      else createEmptyFrameAt(screenToWorld(event.clientX, event.clientY));
      framePlacementRef.current = null;
      setFramePlacementDraft(null);
      return;
    }
    const selection = selectionGestureRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    if (!selection.moved) setSelectedIds(selection.base);
    selectionGestureRef.current = null;
    setSelectionDraft(null);
  };

  const handleContextMenu = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = screenToWorld(event.clientX, event.clientY);
    setContextMenu({ screenX: Math.min(event.clientX - rect.left, rect.width - 210), screenY: Math.min(event.clientY - rect.top, rect.height - 220), worldX: point.x, worldY: point.y });
  };

  const beginItemDrag = (event: ReactPointerEvent<HTMLDivElement>, item: BoardItem) => {
    if (event.button !== 0 || editingId === item.id || activeTool !== "select" || spacePressed) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    if (event.shiftKey) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      setSelectedIds(next);
      setAnnouncement(`${next.size} ${next.size === 1 ? "Object" : "Objects"} selected`);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const dragIds = selectedIds.has(item.id) ? new Set(selectedIds) : new Set([item.id]);
    setSelectedIds(dragIds);
    itemDragRef.current = { ids: expandFrameSelection(dragIds), directIds: dragIds, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, before: items, moved: false };
  };

  const moveItem = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = itemDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - drag.startClientX) / camera.scale;
    const deltaY = (event.clientY - drag.startClientY) / camera.scale;
    drag.moved = drag.moved || Math.abs(deltaX) + Math.abs(deltaY) > 1;
    replace(drag.before.map((item) => drag.ids.has(item.id) ? { ...item, x: item.x + deltaX, y: item.y + deltaY } : item));
  };

  const finishItemDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = itemDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const directlyMovesFrame = items.some((item) => item.type === "frame" && drag.directIds.has(item.id));
      if (!directlyMovesFrame) {
        const itemRects = readItemRects();
        const frames = items.filter((item): item is BoardFrame => item.type === "frame");
        const assignments = new Map<string, string>();
        drag.directIds.forEach((id) => {
          const item = items.find((candidate) => candidate.id === id);
          const itemRect = itemRects.get(id);
          if (!item || item.type === "frame" || !itemRect) return;
          const center = { x: itemRect.left + itemRect.width / 2, y: itemRect.top + itemRect.height / 2 };
          const containingFrames = frames
            .filter((frame) => {
              const frameRect = itemRects.get(frame.id);
              return frameRect && center.x >= frameRect.left && center.x <= frameRect.right && center.y >= frameRect.top && center.y <= frameRect.bottom;
            })
            .sort((left, right) => left.width * left.height - right.width * right.height);
          if (containingFrames[0]) assignments.set(id, containingFrames[0].id);
        });
        replace(items.map((item) => item.type === "frame"
          ? {
              ...item,
              childIds: [
                ...item.childIds.filter((id) => !drag.directIds.has(id)),
                ...[...assignments].filter(([, frameId]) => frameId === item.id).map(([id]) => id),
              ],
            }
          : item));
      }
      checkpoint(drag.before);
      setAnnouncement(`${drag.ids.size} ${drag.ids.size === 1 ? "Object" : "Objects"} moved`);
    }
    itemDragRef.current = null;
  };

  const marqueeRect = selectionDraft?.mode === "marquee" ? rectangleFromPoints(selectionDraft.start, selectionDraft.current) : null;
  const framePlacementRect = framePlacementDraft?.moved
    ? constrainedRectangleFromPoints(framePlacementDraft.start, framePlacementDraft.current)
    : null;
  const selectionToolbarTop = selectionBounds ? (selectionBounds.top > 76 ? selectionBounds.top - 48 : selectionBounds.bottom + 10) : 0;

  return (
    <section
      ref={viewportRef}
      className={`board-viewport is-${activeTool}-tool${spacePressed ? " is-space-ready" : ""}${isPanning ? " is-panning" : ""}`}
      aria-label={`${title} canvas`}
      tabIndex={0}
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={finishViewportGesture}
      onPointerCancel={finishViewportGesture}
      onDoubleClick={(event) => {
        const target = event.target as Element;
        if (target.closest("[data-board-item], .board-toolbar, .multi-selection-toolbar") || activeTool !== "select") return;
        createItem("text", screenToWorld(event.clientX, event.clientY));
      }}
      onContextMenu={handleContextMenu}
    >
      <div className="canvas-field" aria-hidden="true" style={{ backgroundPosition: `${camera.x + 1}px ${camera.y + 1}px`, backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px` }} />
      <div className="canvas-world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        {items.map((item) => {
          const selected = selectedIds.has(item.id);
          const editing = editingId === item.id;
          return (
            <div
              key={item.id}
              data-board-item
              data-board-item-id={item.id}
              className={`board-object ${item.type}-object${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}`}
              style={{
                transform: `translate(${item.x}px, ${item.y}px)`,
                ...(item.type === "frame" ? { width: item.width, height: item.height } : {}),
              }}
              role="group"
              aria-label={`${item.type === "frame" ? "Frame" : item.type}: ${item.text || "Empty"}${selected ? ", selected" : ""}`}
              tabIndex={editing ? -1 : 0}
              onPointerDown={(event) => beginItemDrag(event, item)}
              onPointerMove={moveItem}
              onPointerUp={finishItemDrag}
              onPointerCancel={finishItemDrag}
              onDoubleClick={(event) => { event.stopPropagation(); beginEditing(item); }}
              onFocus={() => { if (!selectedIds.has(item.id)) setSelectedIds(new Set([item.id])); }}
            >
              {item.type === "frame" ? (
                <>
                  <div className="frame-surface">
                    <div className="frame-heading">
                      <span className="frame-accent" aria-hidden="true" />
                      {editing ? (
                        <input
                          data-editor-id={item.id}
                          className="frame-title-editor"
                          value={draftText}
                          aria-label="Edit Frame title"
                          onChange={(event) => setDraftText(event.target.value)}
                          onBlur={finishEditing}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") { event.preventDefault(); cancelEditing(); }
                            if (event.key === "Enter") { event.preventDefault(); finishEditing(); }
                          }}
                        />
                      ) : <span className="frame-title">{item.text}</span>}
                      <span className="frame-count">{item.childIds.length} {item.childIds.length === 1 ? "Object" : "Objects"}</span>
                    </div>
                  </div>
                  {selected && selectedIds.size === 1 && !editing && (
                    <>
                      <div className="frame-move-edges" aria-hidden="true">
                        <span className="frame-move-edge is-north" />
                        <span className="frame-move-edge is-east" />
                        <span className="frame-move-edge is-south" />
                        <span className="frame-move-edge is-west" />
                      </div>
                      <div className="frame-resize-controls" role="group" aria-label="Resize Frame">
                        {FRAME_RESIZE_HANDLES.map((handle) => (
                          <button
                            key={handle}
                            className={`frame-resize-handle is-${handle}`}
                            type="button"
                            aria-label={`Resize Frame from ${handle.replace("-", " ")}`}
                            onPointerDown={(event) => beginFrameResize(event, item, handle)}
                            onDoubleClick={(event) => event.stopPropagation()}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : editing ? (
                <textarea
                  data-editor-id={item.id}
                  className="object-editor"
                  value={draftText}
                  aria-label={`Edit ${item.type}`}
                  placeholder={item.type === "note" ? "Write a note…" : "Start typing…"}
                  onChange={(event) => setDraftText(event.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { event.preventDefault(); cancelEditing(); }
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); finishEditing(); }
                  }}
                />
              ) : <div className="object-surface">{item.text}</div>}
            </div>
          );
        })}
      </div>

      {framePlacementRect && (
        <div
          className="frame-placement-preview"
          aria-hidden="true"
          style={{ left: framePlacementRect.left, top: framePlacementRect.top, width: framePlacementRect.width, height: framePlacementRect.height }}
        >
          <span className="frame-crop-corner is-north-west" />
          <span className="frame-crop-corner is-north-east" />
          <span className="frame-crop-corner is-south-east" />
          <span className="frame-crop-corner is-south-west" />
          <span className="frame-placement-size">
            {Math.round(framePlacementRect.width / camera.scale)} × {Math.round(framePlacementRect.height / camera.scale)}
          </span>
        </div>
      )}

      {marqueeRect && <div className="selection-marquee" aria-hidden="true" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} />}
      {selectionDraft?.mode === "lasso" && (
        <svg className="selection-lasso" aria-hidden="true">
          <polygon points={selectionDraft.points.map((point) => `${point.x},${point.y}`).join(" ")} />
        </svg>
      )}
      {selectionBounds && (
        <>
          <div className="multi-selection-bounds" aria-hidden="true" style={{ left: selectionBounds.left - 7, top: selectionBounds.top - 7, width: selectionBounds.width + 14, height: selectionBounds.height + 14 }} />
          <div className="multi-selection-toolbar" role="toolbar" aria-label={`${selectedIds.size} selected Objects`} style={{ left: selectionBounds.left + selectionBounds.width / 2, top: selectionToolbarTop }} onPointerDown={(event) => event.stopPropagation()}>
            <span>{selectedIds.size} selected</span>
            <span className="multi-selection-divider" aria-hidden="true" />
            <button type="button" onClick={createFrameFromSelection} title="Create Frame (F)">Frame</button>
            <button type="button" onClick={duplicateSelected} title="Duplicate (⌘D)">Duplicate</button>
            <button className="is-destructive" type="button" onClick={deleteSelected} title="Delete">Delete</button>
          </div>
        </>
      )}

      <BoardToolbar
        activeTool={activeTool}
        canUndo={canUndo}
        canRedo={canRedo}
        zoomPercent={Math.round(camera.scale * 100)}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          setAnnouncement(tool === "hand" ? "Pan tool active" : tool === "lasso" ? "Lasso tool active" : "Select tool active");
        }}
        onAddText={() => { setActiveTool("select"); createAtViewportCenter("text"); }}
        onAddNote={() => { setActiveTool("select"); createAtViewportCenter("note"); }}
        onAddFrame={createFrameFromSelection}
        onUndo={() => { undo(); setAnnouncement("Undone"); }}
        onRedo={() => { redo(); setAnnouncement("Redone"); }}
        onZoomOut={() => { zoomAtViewportCenter(1 / 1.12); setAnnouncement("Zoomed out"); }}
        onResetView={() => { setCamera(DEFAULT_CAMERA); setAnnouncement("View reset"); }}
        onZoomIn={() => { zoomAtViewportCenter(1.12); setAnnouncement("Zoomed in"); }}
      />

      {contextMenu && (
        <div className="canvas-context-menu" role="menu" aria-label="Canvas actions" style={{ left: contextMenu.screenX, top: contextMenu.screenY }} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => createItem("text", { x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add text</span><kbd>T</kbd></button>
          <button type="button" role="menuitem" onClick={() => createItem("note", { x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add note</span><kbd>N</kbd></button>
          <button type="button" role="menuitem" onClick={() => createEmptyFrameAt({ x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add Frame</span><kbd>F</kbd></button>
          <div className="context-divider" />
          <button type="button" role="menuitem" disabled={!canUndo} onClick={() => { undo(); setContextMenu(null); setAnnouncement("Undone"); }}><span>Undo</span><kbd>⌘Z</kbd></button>
          <button type="button" role="menuitem" disabled={!canRedo} onClick={() => { redo(); setContextMenu(null); setAnnouncement("Redone"); }}><span>Redo</span><kbd>⇧⌘Z</kbd></button>
          <div className="context-divider" />
          <button type="button" role="menuitem" onClick={() => { setCamera(DEFAULT_CAMERA); setContextMenu(null); setAnnouncement("View reset"); }}><span>Reset view</span><kbd>100%</kbd></button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  );
}
