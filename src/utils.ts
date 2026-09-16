export type Point = { x: number; y: number };
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const normalizeBounds = (start: Point, end: Point) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export const rotatePoint = (
  point: Point,
  center: Point,
  angle: number,
): Point => {
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    x = point.x - center.x,
    y = point.y - center.y;
  return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
};

export const encodeSceneMetadata = (scene: string) => {
  let encoded = "";
  for (const byte of new TextEncoder().encode(scene))
    encoded += String.fromCharCode(byte);
  return JSON.stringify({
    version: "1",
    encoding: "bstring",
    compressed: false,
    encoded,
  });
};

// Excalidraw's isMobileBreakpoint: measured on the editor box, not the viewport,
// so an embedded editor in a narrow column still gets the mobile UI.
export const isMobileBreakpoint = (width: number, height: number) =>
  width <= 599 || (height < 500 && width < 1000);

export const cursorForHandle = (handle: ResizeHandle, angle = 0) => {
  const directions: ResizeHandle[] = [
    "n",
    "ne",
    "e",
    "se",
    "s",
    "sw",
    "w",
    "nw",
  ];
  const index =
    (((directions.indexOf(handle) + Math.round(angle / (Math.PI / 4))) % 8) +
      8) %
    8;
  return `${directions[index]}-resize`;
};

if (import.meta.env.DEV) {
  const bounds = normalizeBounds({ x: 10, y: 20 }, { x: 2, y: 5 });
  console.assert(
    bounds.x === 2 &&
      bounds.y === 5 &&
      bounds.width === 8 &&
      bounds.height === 15,
  );
  const rotated = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
  console.assert(
    Math.abs(rotated.x) < 1e-10 && Math.abs(rotated.y - 1) < 1e-10,
  );
  console.assert(JSON.parse(encodeSceneMetadata("✓")).encoded.length === 3);
  console.assert(
    isMobileBreakpoint(599, 900) &&
      !isMobileBreakpoint(600, 900) &&
      isMobileBreakpoint(900, 499) &&
      !isMobileBreakpoint(1000, 499),
  );
  console.assert(
    cursorForHandle("n") === "n-resize" &&
      cursorForHandle("w") === "w-resize" &&
      cursorForHandle("n", Math.PI / 2) === "e-resize",
  );
}
