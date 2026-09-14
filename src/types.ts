import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

export type WebdrawElement = NonDeletedExcalidrawElement;
export type WebdrawTheme = "light" | "dark" | "auto";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type Arrowhead = null | "arrow" | "bar" | "dot" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | "crowfoot_one" | "crowfoot_many" | "crowfoot_one_or_many";

export type Tool = "hand" | "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "eraser" | "frame" | "image" | "embeddable" | "stickynote" | "laser" | "bucket";

export interface WebdrawInitialData {
  elements?: readonly WebdrawElement[];
  appState?: {
    theme?: WebdrawTheme;
    viewBackgroundColor?: string;
    zoom?: number;
    scrollX?: number;
    scrollY?: number;
  };
}
