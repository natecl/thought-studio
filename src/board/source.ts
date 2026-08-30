import type { BoardSource } from "./types";
import { inferSourceFormat } from "./sourceFormat";
export { inferSourceFormat, sourceFormatGlyph, sourceFormatLabel } from "./sourceFormat";

const DEFAULT_SOURCE_SIZE = { width: 304, height: 184 };
const IMAGE_SOURCE_SIZE = { width: 304, height: 286 };

export const MAX_LOCAL_SOURCE_BYTES = 1_500_000;

function titleFromUrl(url: URL) {
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  const lastMeaningfulSegment = segments.at(-1)?.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  if (lastMeaningfulSegment) {
    const sentenceCaseTitle = `${lastMeaningfulSegment.charAt(0).toUpperCase()}${lastMeaningfulSegment.slice(1)}`;
    return sentenceCaseTitle.length > 54
      ? `${sentenceCaseTitle.slice(0, 51)}…`
      : sentenceCaseTitle;
  }
  return url.hostname.replace(/^www\./, "");
}

export function parseSourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function createUrlSource(value: string, x: number, y: number): BoardSource | null {
  const url = parseSourceUrl(value);
  if (!url) return null;
  const origin = url.hostname.replace(/^www\./, "");
  return {
    id: crypto.randomUUID(),
    type: "source",
    sourceKind: "url",
    sourceFormat: inferSourceFormat({ sourceKind: "url", url: url.toString() }),
    x: x - DEFAULT_SOURCE_SIZE.width / 2,
    y: y - DEFAULT_SOURCE_SIZE.height / 2,
    text: titleFromUrl(url),
    url: url.toString(),
    origin,
    importedAt: new Date().toISOString(),
    width: DEFAULT_SOURCE_SIZE.width,
    height: DEFAULT_SOURCE_SIZE.height,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("This file could not be read."));
    });
    reader.addEventListener("error", () => reject(new Error("This file could not be read.")));
    reader.readAsDataURL(file);
  });
}

export async function createFileSource(file: File, x: number, y: number): Promise<BoardSource> {
  if (file.size > MAX_LOCAL_SOURCE_BYTES) {
    throw new Error("For this local prototype, choose a file smaller than 1.5 MB.");
  }
  const dataUrl = await readFileAsDataUrl(file);
  const sourceKind = file.type.startsWith("image/") ? "image" : "file";
  const size = sourceKind === "image" ? IMAGE_SOURCE_SIZE : DEFAULT_SOURCE_SIZE;
  return {
    id: crypto.randomUUID(),
    type: "source",
    sourceKind,
    sourceFormat: inferSourceFormat({ sourceKind, url: dataUrl, mimeType: file.type, fileName: file.name }),
    x: x - size.width / 2,
    y: y - size.height / 2,
    text: file.name || (sourceKind === "image" ? "Untitled image" : "Untitled file"),
    url: dataUrl,
    origin: sourceKind === "image" ? "Local image" : "Local file",
    importedAt: new Date().toISOString(),
    width: size.width,
    height: size.height,
    mimeType: file.type || "application/octet-stream",
    fileName: file.name,
    fileSize: file.size,
    previewDataUrl: sourceKind === "image" ? dataUrl : undefined,
  };
}

export function formatSourceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Imported";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function sourceInitial(origin: string) {
  return origin.replace(/^www\./, "").charAt(0).toUpperCase() || "S";
}

export function formatFileSize(bytes?: number) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "Local file";
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
