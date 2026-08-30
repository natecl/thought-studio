import type { BoardSource, BoardSourceFormat } from "./types";

const DOCUMENT_EXTENSIONS = /\.(md|mdx|pdf|doc|docx|pages|rtf|txt)$/i;
const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|rb|go|rs|java|kt|swift|css|scss|html|sql|sh|yaml|yml|toml)$/i;
const DATA_EXTENSIONS = /\.(csv|tsv|json|jsonl|xlsx|xls|parquet)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export function inferSourceFormat(source: Pick<BoardSource, "sourceKind" | "url" | "mimeType" | "fileName">): BoardSourceFormat {
  if (source.sourceKind === "image") return "image";
  const name = source.fileName || (() => {
    try { return new URL(source.url).pathname; } catch { return source.url; }
  })();
  const mime = source.mimeType || "";
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/i.test(source.url) || mime.startsWith("video/")) return "video";
  if (IMAGE_EXTENSIONS.test(name) || mime.startsWith("image/")) return "image";
  if (DATA_EXTENSIONS.test(name) || /spreadsheet|csv|json/.test(mime) || /airtable\.com|docs\.google\.com\/spreadsheets/i.test(source.url)) return "data";
  if (CODE_EXTENSIONS.test(name)) return "code";
  if (DOCUMENT_EXTENSIONS.test(name) || /pdf|word|text\/markdown/.test(mime) || /notion\.so|docs\.google\.com\/document/i.test(source.url)) return "document";
  return source.sourceKind === "file" ? "file" : "webpage";
}

export function sourceFormatLabel(format: BoardSourceFormat) {
  return ({ webpage: "Web source", video: "Video source", document: "Document source", code: "Code source", data: "Data source", image: "Image source", file: "File source" })[format];
}

export function sourceFormatGlyph(format: BoardSourceFormat) {
  return ({ webpage: "↗", video: "▶", document: "▤", code: "‹›", data: "▦", image: "▧", file: "+" })[format];
}
