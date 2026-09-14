export type Point = { x: number; y: number };
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const normalizeBounds = (start: Point, end: Point) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const cos = Math.cos(angle), sin = Math.sin(angle), x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
};

export const encodeSceneMetadata = (scene: string) => {
  let encoded = "";
  for (const byte of new TextEncoder().encode(scene)) encoded += String.fromCharCode(byte);
  return JSON.stringify({ version: "1", encoding: "bstring", compressed: false, encoded });
};

export const cursorForHandle = (handle: ResizeHandle, angle = 0) => {
  const direction = { e: 0, w: 0, se: 1, nw: 1, s: 2, n: 2, sw: 3, ne: 3 }[handle];
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][((direction + Math.round(angle / (Math.PI / 4))) % 4 + 4) % 4];
};

if (import.meta.env.DEV) {
  const bounds = normalizeBounds({ x: 10, y: 20 }, { x: 2, y: 5 });
  console.assert(bounds.x === 2 && bounds.y === 5 && bounds.width === 8 && bounds.height === 15);
  const rotated = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
  console.assert(Math.abs(rotated.x) < 1e-10 && Math.abs(rotated.y - 1) < 1e-10);
  console.assert(JSON.parse(encodeSceneMetadata("✓")).encoded.length === 3);
  console.assert(cursorForHandle("e") === "ew-resize" && cursorForHandle("e", Math.PI / 2) === "ns-resize");
}
