import type { BoardSource } from "./types";

const DEFAULT_SOURCE_SIZE = { width: 304, height: 184 };

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

export function formatSourceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Imported";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function sourceInitial(origin: string) {
  return origin.replace(/^www\./, "").charAt(0).toUpperCase() || "S";
}
