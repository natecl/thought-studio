import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  BoardApiError,
  getServiceBoardContext,
  synchronizeServiceCanvas,
} from "../data/boardServiceClient";
import { BoardToolbar, type CanvasTool } from "./BoardToolbar";
import { connectionPath } from "./connection";
import {
  createFileSource as buildFileSource,
  createUrlSource as buildUrlSource,
  formatFileSize,
  formatSourceDate,
  parseSourceUrl,
  sourceInitial,
} from "./source";
import { useBoardHistory } from "./useBoardHistory";
import type {
  AgentSourceReference,
  BoardConnection,
  BoardFrame,
  BoardItem,
  BoardObject,
  BoardObjectType,
  BoardProposal,
  BoardSource,
  Camera,
} from "./types";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: 1 };
const DEFAULT_FRAME_SIZE = { width: 520, height: 320 };
const MIN_FRAME_SIZE = { width: 180, height: 120 };
const FRAME_HORIZONTAL_PADDING = 30;
const FRAME_TOP_PADDING = 48;
const FRAME_BOTTOM_PADDING = 30;
const DEFAULT_PROPOSAL_SIZE = { width: 314, height: 292 };

interface Point { x: number; y: number }
interface ScreenRect { left: number; top: number; right: number; bottom: number; width: number; height: number }
interface ContextMenuState { screenX: number; screenY: number; worldX: number; worldY: number }
interface SourceComposerState { point: Point; value: string; error: string }
interface AgentComposerState { scopeIds: string[]; screenX: number; screenY: number; value: string; error: string }
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
type ServiceSyncState = "loading" | "ready" | "offline" | "conflict";

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

function isConnectable(item: BoardItem) {
  return item.type !== "connection";
}

function itemLabel(item: BoardItem) {
  const text = item.text.trim();
  if (text) return text.length > 42 ? `${text.slice(0, 39)}…` : text;
  if (item.type === "source") return item.fileName || item.origin;
  if (item.type === "frame") return "Untitled frame";
  if (item.type === "proposal") return "Draft proposal";
  return item.type === "note" ? "Untitled note" : "Untitled text";
}

function sourceReference(source: BoardSource): AgentSourceReference {
  return {
    id: source.id,
    title: source.text,
    origin: source.origin,
    url: source.url,
    sourceKind: source.sourceKind,
    fileName: source.fileName,
  };
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
    const crossesHorizontalRay = (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
      (previousPoint.y - currentPoint.y || Number.EPSILON) + currentPoint.x;
    if (crossesHorizontalRay) inside = !inside;
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
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const lastPointerWorldRef = useRef<Point | null>(null);
  const { items, hydrate, commit, replace, checkpoint, undo, redo, canUndo, canRedo } = useBoardHistory(boardId);
  const itemsRef = useRef(items);
  const serviceVersionRef = useRef<number | null>(null);
  const serviceContentVersionRef = useRef<number | null>(null);
  const lastSynchronizedItemsRef = useRef<string | null>(null);
  const synchronizationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [framePlacementDraft, setFramePlacementDraft] = useState<FramePlacementGesture | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<ScreenRect | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sourceComposer, setSourceComposer] = useState<SourceComposerState | null>(null);
  const [agentComposer, setAgentComposer] = useState<AgentComposerState | null>(null);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [announcement, setAnnouncement] = useState("Empty board");
  const [serviceSyncState, setServiceSyncState] = useState<ServiceSyncState>("loading");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: number | undefined;
    setServiceSyncState("loading");
    serviceVersionRef.current = null;
    serviceContentVersionRef.current = null;
    lastSynchronizedItemsRef.current = null;

    const hydrateFromService = async (attempt = 0) => {
      try {
        const context = await getServiceBoardContext(boardId);
        let serviceItems = context.items;
        let version = context.board.version;
        let contentVersion = context.board.contentVersion;
        const cachedItems = itemsRef.current;

        if (serviceItems.length === 0 && cachedItems.length > 0) {
          const migrated = await synchronizeServiceCanvas({
            boardId,
            expectedVersion: version,
            idempotencyKey: `legacy-canvas:${boardId}`,
            items: cachedItems,
          });
          serviceItems = migrated.items;
          version = migrated.version;
          contentVersion = migrated.contentVersion;
        }

        if (cancelled) return;
        serviceVersionRef.current = version;
        serviceContentVersionRef.current = contentVersion;
        lastSynchronizedItemsRef.current = JSON.stringify(serviceItems);
        itemsRef.current = serviceItems;
        hydrate(serviceItems);
        setServiceSyncState("ready");
        setAnnouncement(serviceItems.length === 0 ? "Empty board" : "Board loaded from the shared service");
      } catch (error) {
        if (cancelled) return;
        if (attempt === 0) console.warn("The canonical Board service is unavailable; using the browser cache.", error);
        setServiceSyncState("offline");
        setAnnouncement("Working from the browser cache");
        if (attempt < 4) {
          retryTimeout = window.setTimeout(() => void hydrateFromService(attempt + 1), 700);
        }
      }
    };

    void hydrateFromService();
    return () => {
      cancelled = true;
      if (retryTimeout !== undefined) window.clearTimeout(retryTimeout);
    };
  }, [boardId, hydrate]);

  useEffect(() => {
    if (serviceSyncState !== "ready") return;
    const serializedItems = JSON.stringify(items);
    if (serializedItems === lastSynchronizedItemsRef.current) return;

    const timeout = window.setTimeout(() => {
      const snapshot = structuredClone(items);
      const serializedSnapshot = JSON.stringify(snapshot);
      synchronizationQueueRef.current = synchronizationQueueRef.current.then(async () => {
        if (serializedSnapshot === lastSynchronizedItemsRef.current) return;
        const expectedVersion = serviceVersionRef.current;
        if (expectedVersion === null) return;

        const synchronize = (version: number) => synchronizeServiceCanvas({
          boardId,
          expectedVersion: version,
          idempotencyKey: `canvas-sync:${crypto.randomUUID()}`,
          items: snapshot,
        });

        try {
          let synchronized;
          try {
            synchronized = await synchronize(expectedVersion);
          } catch (error) {
            if (!(error instanceof BoardApiError && error.code === "version_conflict")) throw error;
            const current = await getServiceBoardContext(boardId);
            if (current.board.contentVersion !== serviceContentVersionRef.current) throw error;
            synchronized = await synchronize(current.board.version);
          }
          serviceVersionRef.current = synchronized.version;
          serviceContentVersionRef.current = synchronized.contentVersion;
          lastSynchronizedItemsRef.current = serializedSnapshot;
        } catch (error) {
          console.warn("Canvas changes could not be synchronized.", error);
          if (error instanceof BoardApiError && error.code === "version_conflict") {
            setServiceSyncState("conflict");
            setAnnouncement("Board changed elsewhere. Reload before continuing to synchronize.");
          } else {
            setServiceSyncState("offline");
            setAnnouncement("Board service disconnected. Changes remain in this browser.");
          }
        }
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [boardId, items, serviceSyncState]);

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
    viewport.querySelectorAll<Element>("[data-board-item-id]").forEach((element) => {
      const id = element.getAttribute("data-board-item-id");
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
      .filter((item) => item.type !== "frame" && item.type !== "connection")
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

  const viewportCenterWorld = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [screenToWorld]);

  const addUrlSource = useCallback((value: string, point: Point) => {
    const source = buildUrlSource(value, point.x, point.y);
    if (!source) return false;
    commit([...items, source]);
    setSelectedIds(new Set([source.id]));
    setEditingId(null);
    setContextMenu(null);
    setSourceComposer(null);
    setActiveTool("select");
    setAnnouncement(`Source from ${source.origin} added`);
    return true;
  }, [commit, items]);

  const addFileSources = useCallback(async (files: File[], point: Point) => {
    if (files.length === 0) return false;
    try {
      const sources = await Promise.all(files.map((file, index) =>
        buildFileSource(file, point.x + index * 28, point.y + index * 28),
      ));
      commit([...items, ...sources]);
      setSelectedIds(new Set(sources.map((source) => source.id)));
      setEditingId(null);
      setContextMenu(null);
      setSourceComposer(null);
      setActiveTool("select");
      const imageCount = sources.filter((source) => source.sourceKind === "image").length;
      setAnnouncement(sources.length === 1
        ? `${sources[0].sourceKind === "image" ? "Image" : "File"} Source added`
        : `${sources.length} Sources added${imageCount ? `, including ${imageCount} ${imageCount === 1 ? "image" : "images"}` : ""}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "That file could not be added.";
      if (sourceComposer) setSourceComposer({ ...sourceComposer, error: message });
      setAnnouncement(message);
      return false;
    }
  }, [commit, items, sourceComposer]);

  const createSourceFragment = useCallback((source: BoardSource, kind: "note" | "quote") => {
    const id = crypto.randomUUID();
    const existingFragmentCount = items.filter((item) => item.type === "note" && item.sourceId === source.id).length;
    const note: BoardItem = {
      id,
      type: "note",
      x: source.x + source.width + 36,
      y: source.y + existingFragmentCount * 184,
      text: "",
      sourceId: source.id,
      sourceLinkKind: kind,
      sourceTitle: source.text,
      sourceOrigin: source.origin,
      sourceUrl: source.url,
      sourceKind: source.sourceKind,
      sourceFileName: source.fileName,
    };
    commit([...items, note]);
    setSelectedIds(new Set([id]));
    setEditingId(id);
    setDraftText("");
    setAnnouncement(kind === "quote" ? "Source-linked quotation added" : "Source-linked note added");
  }, [commit, items]);

  const locateSource = useCallback((sourceId: string) => {
    const source = items.find((item): item is BoardSource => item.id === sourceId && item.type === "source");
    if (!source) return false;
    setSelectedIds(new Set([source.id]));
    setEditingId(null);
    setAnnouncement(`Source from ${source.origin} selected`);
    return true;
  }, [items]);

  const locateAgentScope = useCallback((scopeIds: string[]) => {
    const existingIds = scopeIds.filter((id) => items.some((item) => item.id === id));
    if (existingIds.length === 0) {
      setAnnouncement("The original scoped Objects are no longer on this Board");
      return false;
    }
    setSelectedIds(new Set(existingIds));
    setEditingId(null);
    setAnnouncement(`${existingIds.length} original scoped ${existingIds.length === 1 ? "Object" : "Objects"} selected`);
    return true;
  }, [items]);

  const openAgentComposer = useCallback(() => {
    if (!selectionBounds) return;
    const scopeIds = [...selectedIds].filter((id) => items.some((item) => item.id === id && item.type !== "proposal"));
    if (scopeIds.length === 0) return;
    const viewportWidth = viewportRef.current?.clientWidth ?? 720;
    const viewportHeight = viewportRef.current?.clientHeight ?? 640;
    const screenX = Math.max(190, Math.min(viewportWidth - 190, selectionBounds.left + selectionBounds.width / 2));
    const screenY = Math.max(82, Math.min(viewportHeight - 275, selectionBounds.bottom + 12));
    setAgentComposer({ scopeIds, screenX, screenY, value: "", error: "" });
    setSourceComposer(null);
    setContextMenu(null);
    setAnnouncement(`${scopeIds.length} ${scopeIds.length === 1 ? "Object" : "Objects"} scoped for Studio agent`);
  }, [items, selectedIds, selectionBounds]);

  const submitAgentAsk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agentComposer) return;
    const prompt = agentComposer.value.trim();
    if (!prompt) {
      setAgentComposer({ ...agentComposer, error: "Tell the agent what to consider or make." });
      return;
    }
    const scopeItems = agentComposer.scopeIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is BoardItem => Boolean(item));
    if (scopeItems.length === 0) {
      setAgentComposer({ ...agentComposer, error: "That Board scope is no longer available." });
      return;
    }
    const references = new Map<string, AgentSourceReference>();
    scopeItems.forEach((item) => {
      if (item.type === "source") references.set(item.id, sourceReference(item));
      if (item.type === "note") {
        const liveSource = item.sourceId
          ? items.find((candidate): candidate is BoardSource => candidate.id === item.sourceId && candidate.type === "source")
          : undefined;
        if (liveSource) references.set(liveSource.id, sourceReference(liveSource));
        else if (item.sourceUrl) {
          references.set(item.sourceId || item.sourceUrl, {
            id: item.sourceId || item.sourceUrl,
            title: item.sourceTitle || item.text || "Source",
            origin: item.sourceOrigin || "Source",
            url: item.sourceUrl,
            sourceKind: item.sourceKind || "url",
            fileName: item.sourceFileName,
          });
        }
        item.agentSources?.forEach((source) => references.set(source.id, source));
      }
    });
    const sourceCount = references.size;
    const right = Math.max(...scopeItems.map((item) => item.x + (item.type === "source" || item.type === "frame" || item.type === "proposal" ? item.width : 220)));
    const top = Math.min(...scopeItems.map((item) => item.y));
    const proposal: BoardProposal = {
      id: crypto.randomUUID(),
      type: "proposal",
      x: right + 42,
      y: top,
      text: `I’m holding these ${scopeItems.length} Board ${scopeItems.length === 1 ? "entity" : "entities"} as one bounded context${sourceCount ? ` with ${sourceCount} retained ${sourceCount === 1 ? "Source" : "Sources"}` : ""}. Suggested approach: trace the strongest shared idea, separate evidence from open questions, and preserve the original material.`,
      prompt,
      agentName: "Studio agent",
      scopeIds: scopeItems.map((item) => item.id),
      scopeLabels: scopeItems.map(itemLabel),
      sources: [...references.values()],
      createdAt: new Date().toISOString(),
      width: DEFAULT_PROPOSAL_SIZE.width,
      height: DEFAULT_PROPOSAL_SIZE.height,
    };
    commit([...items, proposal]);
    setSelectedIds(new Set([proposal.id]));
    setAgentComposer(null);
    setAnnouncement("Studio agent proposal added for review");
  };

  const acceptProposal = useCallback((proposal: BoardProposal) => {
    const note: BoardObject = {
      id: crypto.randomUUID(),
      type: "note",
      x: proposal.x,
      y: proposal.y,
      text: `Prompt: ${proposal.prompt}\n\n${proposal.text}`,
      authoredBy: "agent",
      authorName: proposal.agentName,
      proposalPrompt: proposal.prompt,
      agentScopeIds: proposal.scopeIds,
      agentScopeLabels: proposal.scopeLabels,
      agentSources: proposal.sources,
    };
    commit([...items.filter((item) => item.id !== proposal.id), note]);
    setSelectedIds(new Set([note.id]));
    setAnnouncement("Agent proposal accepted as an attributed Note");
  }, [commit, items]);

  const rejectProposal = useCallback((proposal: BoardProposal) => {
    commit(items.filter((item) => item.id !== proposal.id));
    setSelectedIds(new Set());
    setAnnouncement("Agent proposal rejected");
  }, [commit, items]);

  const openSourceComposer = useCallback((point = viewportCenterWorld()) => {
    setContextMenu(null);
    setAgentComposer(null);
    setSourceComposer({ point, value: "", error: "" });
    setAnnouncement("Add Source dialog opened");
  }, [viewportCenterWorld]);

  const submitSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceComposer) return;
    if (!addUrlSource(sourceComposer.value, sourceComposer.point)) {
      setSourceComposer({ ...sourceComposer, error: "Enter a valid http or https URL." });
    }
  };

  const chooseSourceFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const point = sourceComposer?.point ?? viewportCenterWorld();
    void addFileSources(files, point);
    event.target.value = "";
  };

  const handleFileDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsFileDragging(true);
  };

  const handleFileDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setIsFileDragging(false);
    void addFileSources(Array.from(event.dataTransfer.files), screenToWorld(event.clientX, event.clientY));
  };

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
    const childIds = [...selectedIds].filter((id) => items.some((item) => item.id === id && item.type !== "frame" && item.type !== "connection"));
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

  const connectSelected = useCallback(() => {
    const endpoints = items.filter((item) => selectedIds.has(item.id) && isConnectable(item));
    if (endpoints.length !== 2) return;
    const [from, to] = endpoints;
    const existing = items.find((item): item is BoardConnection =>
      item.type === "connection" &&
      ((item.fromId === from.id && item.toId === to.id) || (item.fromId === to.id && item.toId === from.id)),
    );
    if (existing) {
      setSelectedIds(new Set([existing.id]));
      setAnnouncement("Connection already exists and is now selected");
      return;
    }
    const connection: BoardConnection = {
      id: crypto.randomUUID(),
      type: "connection",
      x: 0,
      y: 0,
      text: "",
      fromId: from.id,
      toId: to.id,
    };
    commit([...items, connection]);
    setSelectedIds(new Set([connection.id]));
    setEditingId(null);
    setAnnouncement("Objects connected");
  }, [commit, items, selectedIds]);

  const beginEditing = useCallback((item: BoardItem) => {
    if (item.type === "source" || item.type === "connection" || item.type === "proposal") return;
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
    const removedIds = new Set(selectedIds);
    items.forEach((item) => {
      if (item.type === "connection" && (selectedIds.has(item.fromId) || selectedIds.has(item.toId))) {
        removedIds.add(item.id);
      }
    });
    commit(
      items
        .filter((item) => !removedIds.has(item.id))
        .map((item) => item.type === "frame"
          ? { ...item, childIds: item.childIds.filter((id) => !removedIds.has(id)) }
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
    items.forEach((item) => {
      if (item.type === "connection" && idsToClone.has(item.fromId) && idsToClone.has(item.toId)) {
        idsToClone.add(item.id);
      }
    });
    const idMap = new Map([...idsToClone].map((id) => [id, crypto.randomUUID()]));
    const clones = items.filter((item) => idsToClone.has(item.id)).map((item): BoardItem => {
      if (item.type === "frame") {
        return { ...item, id: idMap.get(item.id)!, x: item.x + 24, y: item.y + 24, childIds: item.childIds.map((id) => idMap.get(id) ?? id) };
      }
      if (item.type === "connection") {
        return {
          ...item,
          id: idMap.get(item.id)!,
          fromId: idMap.get(item.fromId) ?? item.fromId,
          toId: idMap.get(item.toId) ?? item.toId,
        };
      }
      if (item.type === "proposal") {
        return {
          ...item,
          id: idMap.get(item.id)!,
          x: item.x + 24,
          y: item.y + 24,
          scopeIds: item.scopeIds.map((id) => idMap.get(id) ?? id),
          sources: item.sources.map((source) => ({ ...source, id: idMap.get(source.id) ?? source.id })),
        };
      }
      if (item.type === "note") {
        return {
          ...item,
          id: idMap.get(item.id)!,
          x: item.x + 24,
          y: item.y + 24,
          sourceId: item.sourceId ? idMap.get(item.sourceId) ?? item.sourceId : undefined,
        };
      }
      return { ...item, id: idMap.get(item.id)!, x: item.x + 24, y: item.y + 24 };
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
    commit(items.map((item) => movementIds.has(item.id) && item.type !== "connection" ? { ...item, x: item.x + x, y: item.y + y } : item));
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
        const itemType = items.find((item) => item.id === id)?.type;
        if (itemType === "frame" || itemType === "connection") return;
        if (rectanglesIntersect(selectionRect, rect)) next.add(id);
      });
    } else if (gesture.points.length >= 3) {
      itemRects.forEach((rect, id) => {
        const itemType = items.find((item) => item.id === id)?.type;
        if (itemType === "frame" || itemType === "connection") return;
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

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement || target?.isContentEditable;
      if (isTyping) return;
      const value = event.clipboardData?.getData("text/plain") ?? "";
      if (!parseSourceUrl(value)) return;
      event.preventDefault();
      addUrlSource(value, lastPointerWorldRef.current ?? viewportCenterWorld());
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addUrlSource, viewportCenterWorld]);

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
      const command = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        if (agentComposer) {
          setAgentComposer(null);
          setAnnouncement("Agent request closed");
          return;
        }
        if (sourceComposer) {
          setSourceComposer(null);
          setAnnouncement("Add Source dialog closed");
          return;
        }
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
      if (command && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        zoomAtViewportCenter(1.12);
        setAnnouncement("Zoomed in");
        return;
      }
      if (command && event.key === "-") {
        event.preventDefault();
        zoomAtViewportCenter(1 / 1.12);
        setAnnouncement("Zoomed out");
        return;
      }
      if (command && event.key === "0") {
        event.preventDefault();
        setCamera(DEFAULT_CAMERA);
        setAnnouncement("View reset");
        return;
      }
      if (isTyping) return;
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
        if (item && item.type !== "source" && item.type !== "connection" && item.type !== "proposal") beginEditing(item);
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
  }, [activeTool, agentComposer, beginEditing, cancelEditing, createAtViewportCenter, createFrameFromSelection, deleteSelected, duplicateSelected, editingId, items, nudgeSelected, redo, selectedIds, sourceComposer, undo, zoomAtViewportCenter]);

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
    lastPointerWorldRef.current = screenToWorld(event.clientX, event.clientY);
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
    const base = event.shiftKey || event.metaKey || event.ctrlKey ? new Set(selectedIds) : new Set<string>();
    const gesture: SelectionGesture = { pointerId: event.pointerId, mode, base, start: point, points: [point], moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectionGestureRef.current = gesture;
    setSelectionDraft({ mode, start: point, current: point, points: [point] });
    setSelectedIds(base);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    lastPointerWorldRef.current = screenToWorld(event.clientX, event.clientY);
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
    if (selection.mode === "lasso") {
      const previousPoint = selection.points.at(-1) ?? selection.start;
      if (Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) >= 2.5) {
        selection.points = [...selection.points, point];
      }
    } else {
      selection.points = [selection.start, point];
    }
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

  const selectConnection = (event: ReactPointerEvent<SVGPathElement>, connection: BoardConnection) => {
    if (event.button !== 0 || activeTool !== "select" || spacePressed) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setEditingId(null);
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(connection.id)) next.delete(connection.id); else next.add(connection.id);
      setSelectedIds(next);
      setAnnouncement(`${next.size} ${next.size === 1 ? "Object" : "Objects"} selected`);
      return;
    }
    setSelectedIds(new Set([connection.id]));
    setAnnouncement("Connection selected");
  };

  const beginItemDrag = (event: ReactPointerEvent<HTMLDivElement>, item: BoardItem) => {
    if (event.button !== 0 || editingId === item.id || activeTool !== "select" || spacePressed) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      setSelectedIds(next);
      setAnnouncement(`${next.size} ${next.size === 1 ? "Object" : "Objects"} selected`);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const dragIds = selectedIds.has(item.id) ? new Set(selectedIds) : new Set([item.id]);
    setSelectedIds(dragIds);
    if (dragIds.size === 1) setAnnouncement("Object selected. Shift-click another Object to select both");
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
  const canConnectSelection = items.filter((item) => selectedIds.has(item.id) && isConnectable(item)).length === 2 &&
    [...selectedIds].every((id) => items.find((item) => item.id === id)?.type !== "connection");
  const canAskSelection = items.filter((item) => selectedIds.has(item.id) && item.type !== "proposal").length >= 2;

  return (
    <>
      <section
      ref={viewportRef}
      className={`board-viewport is-${activeTool}-tool${spacePressed ? " is-space-ready" : ""}${isPanning ? " is-panning" : ""}${isFileDragging ? " is-file-dragging" : ""}`}
      aria-label={`${title} canvas`}
      tabIndex={0}
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={finishViewportGesture}
      onPointerCancel={finishViewportGesture}
      onDragEnter={handleFileDragOver}
      onDragOver={handleFileDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFileDragging(false);
      }}
      onDrop={handleFileDrop}
      onDoubleClick={(event) => {
        const target = event.target as Element;
        if (target.closest("[data-board-item], .board-toolbar, .multi-selection-toolbar") || activeTool !== "select") return;
        createItem("text", screenToWorld(event.clientX, event.clientY));
      }}
      onContextMenu={handleContextMenu}
    >
      <div className="canvas-field" aria-hidden="true" style={{ backgroundPosition: `${camera.x + 1}px ${camera.y + 1}px`, backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px` }} />
      {isFileDragging && (
        <div className="file-drop-surface" aria-hidden="true">
          <span className="file-drop-mark" />
          <strong>Drop into the Board</strong>
          <span>Images and files become Sources with provenance.</span>
        </div>
      )}
      <div className="canvas-world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        <svg className="connection-layer" role="group" aria-label="Board Connections">
          {items.filter((item): item is BoardConnection => item.type === "connection").map((connection) => {
            const path = connectionPath(connection, items);
            if (!path) return null;
            const from = items.find((item) => item.id === connection.fromId);
            const to = items.find((item) => item.id === connection.toId);
            const selected = selectedIds.has(connection.id);
            return (
              <g
                key={connection.id}
                data-board-item
                data-board-item-id={connection.id}
                className={`connection-object${selected ? " is-selected" : ""}`}
                role="group"
                aria-label={`Connection from ${from?.text || from?.type || "Object"} to ${to?.text || to?.type || "Object"}${selected ? ", selected" : ""}`}
                tabIndex={0}
                onFocus={() => setSelectedIds((current) => current.has(connection.id) ? current : new Set([connection.id]))}
              >
                <path className="connection-hit-area" d={path.d} onPointerDown={(event) => selectConnection(event, connection)} />
                <path className="connection-line" d={path.d} />
                <circle className="connection-endpoint" cx={path.start.x} cy={path.start.y} r="3" />
                <circle className="connection-endpoint" cx={path.end.x} cy={path.end.y} r="3" />
              </g>
            );
          })}
        </svg>
        {items.filter((item) => item.type !== "connection").map((item) => {
          const selected = selectedIds.has(item.id);
          const editing = editingId === item.id;
          return (
            <div
              key={item.id}
              data-board-item
              data-board-item-id={item.id}
              className={`board-object ${item.type}-object${item.type === "note" && item.sourceId ? " has-source" : ""}${item.type === "note" && item.sourceLinkKind === "quote" ? " is-quote" : ""}${item.type === "note" && item.authoredBy === "agent" ? " is-agent-authored" : ""}${selected ? " is-selected" : ""}${editing ? " is-editing" : ""}`}
              style={{
                transform: `translate(${item.x}px, ${item.y}px)`,
                ...(item.type === "frame" || item.type === "source" || item.type === "proposal" ? { width: item.width, height: item.height } : {}),
              }}
              role="group"
              aria-label={`${item.type === "frame" ? "Frame" : item.type === "source" ? "Source" : item.type === "proposal" ? "Agent proposal" : item.type}: ${item.text || "Empty"}${selected ? ", selected" : ""}`}
              tabIndex={editing ? -1 : 0}
              onPointerDown={(event) => beginItemDrag(event, item)}
              onPointerMove={moveItem}
              onPointerUp={finishItemDrag}
              onPointerCancel={finishItemDrag}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (item.type !== "source" && item.type !== "proposal") beginEditing(item);
              }}
              onFocus={() => setSelectedIds((current) => current.has(item.id) ? current : new Set([item.id]))}
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
              ) : item.type === "proposal" ? (
                <ProposalCard proposal={item} onAccept={acceptProposal} onReject={rejectProposal} onLocateScope={locateAgentScope} />
              ) : item.type === "source" ? (
                <SourceCard source={item} selected={selected && selectedIds.size === 1} onCreateFragment={createSourceFragment} />
              ) : editing ? (
                <textarea
                  data-editor-id={item.id}
                  className="object-editor"
                  value={draftText}
                  aria-label={`Edit ${item.type}`}
                  placeholder={item.type === "note"
                    ? item.sourceLinkKind === "quote" ? "Paste or write the quotation…" : item.sourceId ? "Write a note from this source…" : "Write a note…"
                    : "Start typing…"}
                  onChange={(event) => setDraftText(event.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { event.preventDefault(); cancelEditing(); }
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); finishEditing(); }
                  }}
                />
              ) : <div className="object-surface">{item.text}</div>}
              {item.type === "note" && item.sourceId && (
                <SourceLineageFooter note={item} sourceExists={items.some((candidate) => candidate.id === item.sourceId && candidate.type === "source")} onLocateSource={locateSource} />
              )}
              {item.type === "note" && item.authoredBy === "agent" && (
                <AgentLineageFooter note={item} onLocateScope={locateAgentScope} />
              )}
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
          <polyline points={selectionDraft.points.map((point) => `${point.x},${point.y}`).join(" ")} />
        </svg>
      )}
      {selectionBounds && (
        <>
          <div className="multi-selection-bounds" aria-hidden="true" style={{ left: selectionBounds.left - 7, top: selectionBounds.top - 7, width: selectionBounds.width + 14, height: selectionBounds.height + 14 }} />
          <div className="multi-selection-toolbar" role="toolbar" aria-label={`${selectedIds.size} selected Objects`} style={{ left: selectionBounds.left + selectionBounds.width / 2, top: selectionToolbarTop }} onPointerDown={(event) => event.stopPropagation()}>
            <span>{selectedIds.size} selected</span>
            <span className="multi-selection-divider" aria-hidden="true" />
            {canAskSelection && <button className="is-agent-action" type="button" onClick={openAgentComposer} title="Ask Studio agent about this selection">Ask agent</button>}
            {canConnectSelection && <button type="button" onClick={connectSelected} title="Connect selected Objects">Connect</button>}
            <button type="button" onClick={createFrameFromSelection} title="Create Frame (F)">Frame</button>
            <button type="button" onClick={duplicateSelected} title="Duplicate (⌘D)">Duplicate</button>
            <button className="is-destructive" type="button" onClick={deleteSelected} title="Delete">Delete</button>
          </div>
        </>
      )}

      {sourceComposer && (
        <form className="source-composer" aria-label="Add a Source" onSubmit={submitSource} onPointerDown={(event) => event.stopPropagation()}>
          <div className="source-composer-heading">
            <span className="source-composer-mark" aria-hidden="true" />
            <div>
              <strong>Bring in a source</strong>
              <span>Its origin stays attached.</span>
            </div>
          </div>
          <label htmlFor="source-url-input">Web address</label>
          <input
            id="source-url-input"
            autoFocus
            inputMode="url"
            type="text"
            value={sourceComposer.value}
            placeholder="https://…"
            aria-describedby={sourceComposer.error ? "source-url-error" : "source-url-hint"}
            onChange={(event) => setSourceComposer({ ...sourceComposer, value: event.target.value, error: "" })}
          />
          {sourceComposer.error
            ? <span className="source-composer-error" id="source-url-error" role="alert">{sourceComposer.error}</span>
            : <span className="source-composer-hint" id="source-url-hint">Tip: paste a URL anywhere on the Board.</span>}
          <div className="source-composer-divider"><span>or</span></div>
          <button className="source-file-button" type="button" onClick={() => sourceFileInputRef.current?.click()}>
            <span className="source-file-button-mark" aria-hidden="true">+</span>
            Choose an image or file
          </button>
          <span className="source-composer-hint">Files stay attached to this local Board prototype. Maximum 1.5 MB each.</span>
          <div className="source-composer-actions">
            <button type="button" onClick={() => setSourceComposer(null)}>Cancel</button>
            <button className="is-primary" type="submit">Add to Board</button>
          </div>
        </form>
      )}

      {agentComposer && (
        <form
          className="agent-composer"
          aria-label="Ask Studio agent"
          style={{ left: agentComposer.screenX, top: agentComposer.screenY }}
          onSubmit={submitAgentAsk}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="agent-composer-heading">
            <span className="agent-identity-mark" aria-hidden="true" />
            <div>
              <strong>Ask Studio agent</strong>
              <span>{agentComposer.scopeIds.length} selected {agentComposer.scopeIds.length === 1 ? "Object" : "Objects"} define the context.</span>
            </div>
          </div>
          <label htmlFor="agent-request-input">Request</label>
          <textarea
            id="agent-request-input"
            autoFocus
            value={agentComposer.value}
            placeholder="Find the underlying question…"
            aria-describedby={agentComposer.error ? "agent-request-error" : "agent-request-hint"}
            onChange={(event) => setAgentComposer({ ...agentComposer, value: event.target.value, error: "" })}
          />
          {agentComposer.error
            ? <span className="agent-composer-error" id="agent-request-error" role="alert">{agentComposer.error}</span>
            : <span className="agent-composer-hint" id="agent-request-hint">This creates a visible proposal. Your selected material will not be changed.</span>}
          <div className="agent-composer-actions">
            <button type="button" onClick={() => setAgentComposer(null)}>Cancel</button>
            <button className="is-primary" type="submit">Create proposal</button>
          </div>
        </form>
      )}

      <input
        ref={sourceFileInputRef}
        className="source-file-input"
        type="file"
        multiple
        aria-label="Choose images or files to add as Sources"
        onChange={chooseSourceFiles}
      />

      {(serviceSyncState === "offline" || serviceSyncState === "conflict") && (
        <div className={`board-service-status is-${serviceSyncState}`} role="status">
          <span aria-hidden="true" />
          {serviceSyncState === "conflict"
            ? "Board changed elsewhere. Reload to review it."
            : "Changes remain in this browser. Reload after the Board service returns."}
        </div>
      )}

      {contextMenu && (
        <div className="canvas-context-menu" role="menu" aria-label="Canvas actions" style={{ left: contextMenu.screenX, top: contextMenu.screenY }} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => createItem("text", { x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add text</span><kbd>T</kbd></button>
          <button type="button" role="menuitem" onClick={() => createItem("note", { x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add note</span><kbd>N</kbd></button>
          <button type="button" role="menuitem" onClick={() => openSourceComposer({ x: contextMenu.worldX, y: contextMenu.worldY })}><span>Add Source</span><kbd>⌘V</kbd></button>
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
        onAddSource={() => openSourceComposer()}
        onAddFrame={createFrameFromSelection}
        onUndo={() => { undo(); setAnnouncement("Undone"); }}
        onRedo={() => { redo(); setAnnouncement("Redone"); }}
        onZoomOut={() => { zoomAtViewportCenter(1 / 1.12); setAnnouncement("Zoomed out"); }}
        onResetView={() => { setCamera(DEFAULT_CAMERA); setAnnouncement("View reset"); }}
        onZoomIn={() => { zoomAtViewportCenter(1.12); setAnnouncement("Zoomed in"); }}
      />
    </>
  );
}

function SourceCard({
  source,
  selected,
  onCreateFragment,
}: {
  source: BoardSource;
  selected: boolean;
  onCreateFragment: (source: BoardSource, kind: "note" | "quote") => void;
}) {
  const isUrl = source.sourceKind === "url";
  const isImage = source.sourceKind === "image";
  const sourceLabel = isUrl ? "Source" : isImage ? "Image source" : "File source";
  const fileDetail = source.mimeType && source.mimeType !== "application/octet-stream"
    ? `${formatFileSize(source.fileSize)} · ${source.mimeType.replace(/^application\//, "")}`
    : formatFileSize(source.fileSize);
  return (
    <article className={`source-surface is-${source.sourceKind}`}>
      {selected && (
        <div className="source-fragment-toolbar" role="toolbar" aria-label="Create from Source" onPointerDown={(event) => event.stopPropagation()}>
          <span>Keep context</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); onCreateFragment(source, "note"); }}>Note</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onCreateFragment(source, "quote"); }}>Quote</button>
        </div>
      )}
      <header className="source-kicker">
        <span className="source-kicker-mark" aria-hidden="true" />
        <span>{sourceLabel}</span>
        <time dateTime={source.importedAt} title={`Imported ${new Date(source.importedAt).toLocaleString()}`}>
          {formatSourceDate(source.importedAt)}
        </time>
      </header>
      {isImage && source.previewDataUrl ? (
        <div className="source-image-preview">
          <img src={source.previewDataUrl} alt="" draggable={false} />
          <div className="source-preview-copy">
            <strong>{source.text}</strong>
            <span>{fileDetail}</span>
          </div>
        </div>
      ) : (
        <div className="source-preview">
          <span className={`source-origin-mark${isUrl ? "" : " is-file"}`} aria-hidden="true">
            {isUrl ? sourceInitial(source.origin) : <FileSourceGlyph />}
          </span>
          <div className="source-preview-copy">
            <strong>{source.text}</strong>
            <span>{isUrl ? source.origin : fileDetail}</span>
          </div>
        </div>
      )}
      <footer className="source-footer">
        <span className="source-provenance">{isUrl ? "Original link retained" : "Original file attached"}</span>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          download={isUrl ? undefined : source.fileName}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {isUrl ? "Open" : isImage ? "View" : "Download"} <span aria-hidden="true">{isUrl ? "↗" : "↓"}</span>
        </a>
      </footer>
    </article>
  );
}

function ProposalCard({
  proposal,
  onAccept,
  onReject,
  onLocateScope,
}: {
  proposal: BoardProposal;
  onAccept: (proposal: BoardProposal) => void;
  onReject: (proposal: BoardProposal) => void;
  onLocateScope: (scopeIds: string[]) => boolean;
}) {
  return (
    <article className="proposal-surface">
      <header className="proposal-heading">
        <span className="agent-identity-mark" aria-hidden="true" />
        <div>
          <strong>{proposal.agentName}</strong>
          <span>Draft proposal</span>
        </div>
        <time dateTime={proposal.createdAt}>{formatSourceDate(proposal.createdAt)}</time>
      </header>
      <blockquote>{proposal.prompt}</blockquote>
      <p>{proposal.text}</p>
      <div className="proposal-scope" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => onLocateScope(proposal.scopeIds)}>
          {proposal.scopeIds.length} scoped
        </button>
        {proposal.sources.length > 0 && (
          <span title={proposal.sources.map((source) => `${source.title} — ${source.origin}`).join("\n")}>
            {proposal.sources.length} {proposal.sources.length === 1 ? "Source" : "Sources"}
          </span>
        )}
      </div>
      <footer className="proposal-actions" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => onReject(proposal)}>Reject</button>
        <button className="is-primary" type="button" onClick={() => onAccept(proposal)}>Accept as note</button>
      </footer>
    </article>
  );
}

function AgentLineageFooter({
  note,
  onLocateScope,
}: {
  note: BoardObject;
  onLocateScope: (scopeIds: string[]) => boolean;
}) {
  const scopeCount = note.agentScopeIds?.length ?? note.agentScopeLabels?.length ?? 0;
  const sourceCount = note.agentSources?.length ?? 0;
  return (
    <footer className="agent-lineage" onPointerDown={(event) => event.stopPropagation()}>
      <span className="agent-identity-mark" aria-hidden="true" />
      <strong>{note.authorName || "Studio agent"}</strong>
      {scopeCount > 0 && note.agentScopeIds ? (
        <button type="button" title="Locate the original scoped Objects" onClick={() => onLocateScope(note.agentScopeIds!)}>
          · {scopeCount} scoped
        </button>
      ) : scopeCount > 0 ? <span>· {scopeCount} scoped</span> : null}
      {sourceCount > 0 && <span title={note.agentSources?.map((source) => `${source.title} — ${source.origin}`).join("\n")}>· {sourceCount} {sourceCount === 1 ? "Source" : "Sources"}</span>}
    </footer>
  );
}

function FileSourceGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h6.5L18 8v12.5H7z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9.5 12h6M9.5 15h5" />
    </svg>
  );
}

function SourceLineageFooter({
  note,
  sourceExists,
  onLocateSource,
}: {
  note: BoardObject;
  sourceExists: boolean;
  onLocateSource: (sourceId: string) => boolean;
}) {
  const origin = note.sourceOrigin || note.sourceTitle || "Source";
  return (
    <footer className="note-lineage" onPointerDown={(event) => event.stopPropagation()}>
      <span className="note-lineage-kind">{note.sourceLinkKind === "quote" ? "Quote" : "Note"}</span>
      {sourceExists && note.sourceId ? (
        <button type="button" title={`Locate ${note.sourceTitle || "Source"}`} onClick={() => onLocateSource(note.sourceId!)}>
          from {origin}
        </button>
      ) : (
        <span className="note-lineage-origin">from {origin}</span>
      )}
      {note.sourceUrl && (
        <a
          href={note.sourceUrl}
          target="_blank"
          rel="noreferrer"
          download={note.sourceKind && note.sourceKind !== "url" ? note.sourceFileName : undefined}
          aria-label={`${note.sourceKind && note.sourceKind !== "url" ? "Download" : "Open"} original Source from ${origin}`}
          onClick={(event) => event.stopPropagation()}
        >
          {note.sourceKind && note.sourceKind !== "url" ? "↓" : "↗"}
        </a>
      )}
    </footer>
  );
}
