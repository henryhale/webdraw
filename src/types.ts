import type {
  Arrowhead as ExcalidrawArrowhead,
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export type WebdrawElement = NonDeletedExcalidrawElement;
export type WebdrawTheme = "light" | "dark" | "auto";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type Arrowhead = ExcalidrawArrowhead | null;

export type Tool =
  | "hand"
  | "selection"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "eraser"
  | "frame"
  | "image"
  | "embeddable"
  | "stickynote"
  | "laser"
  | "bucket";

export interface WebdrawBinaryFileData {
  id: FileId;
  dataURL: string;
  mimeType: string;
  created: number;
  lastRetrieved?: number;
  version?: number;
}

export type WebdrawBinaryFiles = Record<string, WebdrawBinaryFileData>;

export interface WebdrawInitialData {
  elements?: readonly WebdrawElement[];
  appState?: {
    theme?: WebdrawTheme;
    viewBackgroundColor?: string;
    zoom?: number | { value: number };
    scrollX?: number;
    scrollY?: number;
    currentItemRoundness?: "sharp" | "round";
  };
  files?: WebdrawBinaryFiles;
}
