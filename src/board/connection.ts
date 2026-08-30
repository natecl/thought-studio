import type { BoardConnection, BoardItem } from "./types";

interface Point {
  x: number;
  y: number;
}

function textSize(text: string) {
  const lines = text.split("\n");
  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  return {
    width: Math.min(440, Math.max(40, longestLine * 12.5 + 12)),
    height: Math.max(35, lines.length * 27 + 8),
  };
}

export function itemCenter(item: Exclude<BoardItem, BoardConnection>): Point {
  if (item.type === "frame" || item.type === "source") {
    return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  }
  if (item.type === "note") return { x: item.x + 110, y: item.y + 82 };
  const size = textSize(item.text);
  return { x: item.x + size.width / 2, y: item.y + size.height / 2 };
}

export function connectionPath(connection: BoardConnection, items: BoardItem[]) {
  const from = items.find((item): item is Exclude<BoardItem, BoardConnection> =>
    item.id === connection.fromId && item.type !== "connection");
  const to = items.find((item): item is Exclude<BoardItem, BoardConnection> =>
    item.id === connection.toId && item.type !== "connection");
  if (!from || !to) return null;
  const start = itemCenter(from);
  const end = itemCenter(to);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const bend = Math.min(30, distance * 0.065);
  const control = {
    x: (start.x + end.x) / 2 - (deltaY / distance) * bend,
    y: (start.y + end.y) / 2 + (deltaX / distance) * bend,
  };
  return {
    d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    start,
    end,
    label: {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    },
  };
}
