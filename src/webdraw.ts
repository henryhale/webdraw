import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import rough from "roughjs/bin/rough";
import { getStroke } from "perfect-freehand";
import {
  newElement,
  newFreeDrawElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import "./styles.scss";

export type WebdrawElement = NonDeletedExcalidrawElement;
export type WebdrawTheme = "light" | "dark";

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

type Tool =
  | "hand"
  | "selection"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "eraser";
type Point = { x: number; y: number };
type MutableElement = WebdrawElement & Record<string, any>;
type Drag = {
  mode: "draw" | "move" | "pan" | "select" | "erase";
  start: Point;
  last: Point;
  draftId?: string;
  origins?: Map<string, Point>;
  pan?: Point;
  checkpointed?: boolean;
};

const TOOL_META: readonly [Tool, string, string][] = [
  ["hand", "Hand (H)", ""],
  ["selection", "Selection (V or 1)", "1"],
  ["rectangle", "Rectangle (R or 2)", "2"],
  ["diamond", "Diamond (D or 3)", "3"],
  ["ellipse", "Ellipse (O or 4)", "4"],
  ["arrow", "Arrow (A or 5)", "5"],
  ["line", "Line (L or 6)", "6"],
  ["freedraw", "Draw (P or 7)", "7"],
  ["text", "Text (T or 8)", "8"],
  ["eraser", "Eraser (E or 0)", "0"],
];

const svg = (body: TemplateResult, viewBox = "0 0 24 24") => html`
  <svg aria-hidden="true" focusable="false" viewBox=${viewBox} fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </svg>`;

const icon = (name: Tool | "menu" | "library" | "undo" | "redo" | "help" | "more") => {
  switch (name) {
    case "hand": return svg(html`<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 5.5v-2a1.5 1.5 0 1 1 3 0V12M14 5.5a1.5 1.5 0 0 1 3 0V12M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.8-2.7L3.7 13.3a1.5 1.5 0 0 1 2.8-1.7L8 13Z"/>`);
    case "selection": return svg(html`<path d="m6 6 4.15 11.8c.1.27.48.28.67 0L13 13l4.79-2c.28-.12.28-.52 0-.64L6 6Zm7.5 7.5L18 18"/>`);
    case "rectangle": return svg(html`<rect x="4" y="4" width="16" height="16" rx="2"/>`);
    case "diamond": return svg(html`<path d="m10.5 20.4-6.9-6.9a2.2 2.2 0 0 1 0-3l6.9-6.9a2.2 2.2 0 0 1 3 0l6.9 6.9a2.2 2.2 0 0 1 0 3l-6.9 6.9a2.2 2.2 0 0 1-3 0Z"/>`);
    case "ellipse": return svg(html`<circle cx="12" cy="12" r="9"/>`);
    case "arrow": return svg(html`<path d="M5 12h14m-4-4 4 4-4 4"/>`);
    case "line": return svg(html`<path d="M5 12h14"/>`);
    case "freedraw": return svg(html`<path d="m7.6 18.7 9.3-9.3a2.8 2.8 0 0 0-4-4l-9.3 9.3A4 4 0 0 0 2.5 17.5v2h2a4 4 0 0 0 3.1-.8ZM12 6.5l4 4"/>`);
    case "text": return svg(html`<path d="M4 20h3m7 0h7M7 15h7M10 6h6L6 20m6-16 8 16"/>`);
    case "eraser": return svg(html`<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20M18 13.3 11.7 7"/>`);
    case "menu": return svg(html`<path d="M4 6h16M4 12h16M4 18h16"/>`);
    case "library": return svg(html`<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13"/>`);
    case "undo": return svg(html`<path d="M9 13 5 9l4-4M5 9h11a4 4 0 0 1 0 8h-2"/>`);
    case "redo": return svg(html`<path d="m15 13 4-4-4-4m4 4H8a4 4 0 0 0 0 8h2"/>`);
    case "help": return svg(html`<circle cx="12" cy="12" r="9"/><path d="M12 17v.01M12 14a2 2 0 0 1 1.3-1.9A3 3 0 1 0 9 9"/>`);
    case "more": return svg(html`<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>`);
  }
};

const normalizeBounds = (start: Point, end: Point) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

if (import.meta.env.DEV) {
  const bounds = normalizeBounds({ x: 10, y: 20 }, { x: 2, y: 5 });
  console.assert(bounds.x === 2 && bounds.y === 5 && bounds.width === 8 && bounds.height === 15);
}

export class WebDraw extends LitElement {
  static properties = {
    theme: { type: String, reflect: true },
    viewModeEnabled: { type: Boolean, attribute: "view-mode", reflect: true },
    zenModeEnabled: { type: Boolean, attribute: "zen-mode", reflect: true },
    gridModeEnabled: { type: Boolean, attribute: "grid-mode", reflect: true },
    initialData: { attribute: false },
    elements: { attribute: false },
    tool: { state: true },
    zoom: { state: true },
    menuOpen: { state: true },
    libraryOpen: { state: true },
    editingText: { state: true },
    selectedIds: { state: true },
  };

  theme: WebdrawTheme = "light";
  viewModeEnabled = false;
  zenModeEnabled = false;
  gridModeEnabled = false;
  initialData?: WebdrawInitialData;
  elements: WebdrawElement[] = [];
  tool: Tool = "selection";
  zoom = 1;
  menuOpen = false;
  libraryOpen = false;
  editingText: Point | null = null;
  selectedIds = new Set<string>();

  private canvas?: HTMLCanvasElement;
  private observer?: ResizeObserver;
  private drag: Drag | null = null;
  private selectionRect: { start: Point; end: Point } | null = null;
  private pan = { x: 0, y: 0 };
  private history: WebdrawElement[][] = [];
  private future: WebdrawElement[][] = [];
  private strokeColor = "#1b1b1f";
  private backgroundColor = "transparent";
  private canvasColor = "#ffffff";
  private strokeWidth = 2;
  private roughness = 1;
  private textDraft = "";

  protected createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.tabIndex = 0;
    this.setAttribute("role", "application");
    this.setAttribute("aria-label", "Excalidraw canvas");
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    super.disconnectedCallback();
  }

  protected firstUpdated() {
    this.canvas = this.querySelector("canvas") ?? undefined;
    this.observer = new ResizeObserver(() => this.paint());
    this.observer.observe(this);
    this.dispatchEvent(new CustomEvent("webdraw-ready", { bubbles: true, composed: true }));
    this.paint();
  }

  protected willUpdate(changes: PropertyValues<this>) {
    if (changes.has("initialData") && this.initialData) {
      this.elements = structuredClone([...(this.initialData.elements ?? [])]);
      const state = this.initialData.appState;
      if (state?.theme) this.theme = state.theme;
      if (state?.viewBackgroundColor) this.canvasColor = state.viewBackgroundColor;
      if (state?.zoom) this.zoom = state.zoom;
      this.pan = { x: state?.scrollX ?? 0, y: state?.scrollY ?? 0 };
    }
  }

  protected updated() {
    this.paint();
    if (this.editingText) {
      const area = this.querySelector<HTMLTextAreaElement>(".webdraw-text-editor");
      area?.focus();
    }
  }

  getSceneElements(): readonly WebdrawElement[] { return this.elements; }

  getAppState() {
    return {
      theme: this.theme,
      viewBackgroundColor: this.canvasColor,
      zoom: { value: this.zoom },
      scrollX: this.pan.x,
      scrollY: this.pan.y,
      activeTool: { type: this.tool },
      selectedElementIds: Object.fromEntries([...this.selectedIds].map((id) => [id, true])),
    };
  }

  updateScene(scene: WebdrawInitialData) {
    this.checkpoint();
    if (scene.elements) this.elements = structuredClone([...scene.elements]);
    if (scene.appState?.theme) this.theme = scene.appState.theme;
    if (scene.appState?.viewBackgroundColor) this.canvasColor = scene.appState.viewBackgroundColor;
    if (scene.appState?.zoom) this.zoom = scene.appState.zoom;
    this.emitChange();
  }

  resetScene() {
    this.checkpoint();
    this.elements = [];
    this.selectedIds = new Set();
    this.emitChange();
  }

  private renderTool([tool, label, shortcut]: readonly [Tool, string, string]) {
    const active = this.tool === tool;
    return html`
      <button class="ToolIcon ToolIcon_type_toggle ${active ? "ToolIcon--checked" : ""}"
        title=${label} aria-label=${label} aria-pressed=${active}
        data-testid=${`toolbar-${tool}`} @click=${() => this.setTool(tool)}>
        <span class="ToolIcon__icon">${icon(tool)}</span>
        ${shortcut ? html`<span class="ToolIcon__keybinding">${shortcut}</span>` : nothing}
      </button>`;
  }

  protected render() {
    const cursor = this.viewModeEnabled ? "default" : this.tool === "hand" ? "grab" : this.tool === "selection" ? "default" : this.tool === "text" ? "text" : "crosshair";
    return html`
      <div class="excalidraw ${this.theme === "dark" ? "theme--dark" : ""}" dir="ltr"
        style=${`--canvas-background: ${this.canvasColor}; --canvas-cursor: ${cursor}`} @keydown=${this.onKeyDown}>
        <canvas class="excalidraw__canvas interactive" aria-label="Drawing canvas"
          @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp}
          @wheel=${this.onWheel}></canvas>

        <div class="layer-ui__wrapper">
          ${this.zenModeEnabled ? nothing : html`
            <div class="FixedSideContainer FixedSideContainer_side_top">
              <div class="App-menu App-menu_top">
                <div class="App-menu_top__left">
                  <button class="webdraw-floating ToolIcon ToolIcon_type_button" aria-label="Open menu"
                    title="Open menu" @click=${() => { this.menuOpen = !this.menuOpen; this.libraryOpen = false; }}>
                    <span class="ToolIcon__icon">${icon("menu")}</span>
                  </button>
                  ${this.menuOpen ? this.renderMenu() : nothing}
                  ${this.renderProperties()}
                </div>

                ${this.viewModeEnabled ? nothing : html`
                  <section class="shapes-section" aria-label="Shapes">
                    <div class="App-toolbar-container">
                      <div class="Island App-toolbar" data-viewport-ui="top">
                        <div class="Stack Stack_horizontal toolbar-row">
                          ${TOOL_META.map((tool) => this.renderTool(tool))}
                          <span class="App-toolbar__divider"></span>
                          <button class="ToolIcon ToolIcon_type_toggle" title="More tools" aria-label="More tools">
                            <span class="ToolIcon__icon">${icon("more")}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>`}

                <div class="layer-ui__wrapper__top-right">
                  <button class="library-button" @click=${() => { this.libraryOpen = !this.libraryOpen; this.menuOpen = false; }}>
                    ${icon("library")}<span>Library</span>
                  </button>
                  ${this.libraryOpen ? html`
                    <aside class="Island library-panel">
                      <header><strong>Library</strong><button aria-label="Close library" @click=${() => this.libraryOpen = false}>×</button></header>
                      <div class="library-empty">Browse libraries or drag reusable elements here.</div>
                    </aside>` : nothing}
                </div>
              </div>
            </div>`}

          <div class="layer-ui__wrapper__footer">
            <div class="layer-ui__wrapper__footer-left">
              <div class="Island zoom-actions">
                <button @click=${() => this.setZoom(this.zoom - .1)} aria-label="Zoom out">−</button>
                <button class="zoom-value" @click=${() => this.setZoom(1)}>${Math.round(this.zoom * 100)}%</button>
                <button @click=${() => this.setZoom(this.zoom + .1)} aria-label="Zoom in">+</button>
              </div>
              <div class="Island undo-actions">
                <button @click=${this.undo} ?disabled=${!this.history.length} aria-label="Undo">${icon("undo")}</button>
                <button @click=${this.redo} ?disabled=${!this.future.length} aria-label="Redo">${icon("redo")}</button>
              </div>
            </div>
            <div class="layer-ui__wrapper__footer-right">
              <button class="webdraw-floating help-button" title="Help" aria-label="Help">${icon("help")}</button>
            </div>
          </div>
        </div>

        ${this.editingText ? html`
          <textarea class="webdraw-text-editor" aria-label="Text" .value=${this.textDraft}
            style=${`left:${this.editingText.x * this.zoom + this.pan.x}px;top:${this.editingText.y * this.zoom + this.pan.y}px;font-size:${20 * this.zoom}px`}
            @input=${(event: InputEvent) => this.textDraft = (event.target as HTMLTextAreaElement).value}
            @keydown=${this.onTextKeyDown} @blur=${this.commitText}></textarea>` : nothing}
      </div>`;
  }

  private renderMenu() {
    return html`
      <div class="Island dropdown-menu" role="menu">
        <button role="menuitem" @click=${() => this.querySelector<HTMLInputElement>(".scene-input")?.click()}>Open</button>
        <button role="menuitem" @click=${this.saveScene}>Save to file</button>
        <button role="menuitem" @click=${this.exportPng}>Export image</button>
        <span class="dropdown-separator"></span>
        <button role="menuitem" @click=${this.resetScene}>Reset the canvas</button>
        <span class="dropdown-separator"></span>
        <button role="menuitem" @click=${this.toggleTheme}>${this.theme === "dark" ? "Light" : "Dark"} mode</button>
        <label class="canvas-color">Canvas background <input type="color" .value=${this.canvasColor} @input=${this.onCanvasColor}></label>
        <input class="scene-input" type="file" accept="application/json,.excalidraw" @change=${this.openScene} />
      </div>`;
  }

  private renderProperties() {
    if (this.viewModeEnabled || (this.tool === "selection" && !this.selectedIds.size) || this.tool === "hand" || this.tool === "eraser") return nothing;
    return html`
      <div class="Island selected-shape-actions">
        <label>Stroke <input type="color" .value=${this.strokeColor} @input=${this.onStrokeColor}></label>
        <label>Background <span class="color-row"><button class=${this.backgroundColor === "transparent" ? "selected" : ""} @click=${() => this.setBackground("transparent")}>×</button><input type="color" value="#a5d8ff" @input=${(event: InputEvent) => this.setBackground((event.target as HTMLInputElement).value)}></span></label>
        <label>Stroke width <span class="segmented">${[1, 2, 4].map((width) => html`<button class=${this.strokeWidth === width ? "selected" : ""} @click=${() => this.setStrokeWidth(width)}>${width}</button>`)}</span></label>
        <label>Sloppiness <span class="segmented">${[0, 1, 2].map((value) => html`<button class=${this.roughness === value ? "selected" : ""} @click=${() => this.setRoughness(value)}>${value + 1}</button>`)}</span></label>
      </div>`;
  }

  private setTool(tool: Tool) {
    if (this.viewModeEnabled) return;
    this.tool = tool;
    if (tool !== "selection") this.selectedIds = new Set();
    this.focus();
  }

  private scenePoint(event: PointerEvent): Point {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: (event.clientX - rect.left - this.pan.x) / this.zoom, y: (event.clientY - rect.top - this.pan.y) / this.zoom };
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.viewModeEnabled || (event.button !== 0 && event.button !== 1) || this.editingText) return;
    this.focus();
    this.canvas!.setPointerCapture(event.pointerId);
    const point = this.scenePoint(event);
    if (this.tool === "hand" || event.button === 1 || event.altKey) {
      this.drag = { mode: "pan", start: point, last: { x: event.clientX, y: event.clientY }, pan: { ...this.pan } };
      return;
    }
    if (this.tool === "text") {
      this.editingText = point;
      this.textDraft = "";
      return;
    }
    if (this.tool === "eraser") {
      this.drag = { mode: "erase", start: point, last: point };
      this.eraseAt(point);
      return;
    }
    if (this.tool === "selection") {
      const hit = this.hitTest(point);
      if (hit) {
        if (!event.shiftKey && !this.selectedIds.has(hit.id)) this.selectedIds = new Set([hit.id]);
        else if (event.shiftKey) {
          const next = new Set(this.selectedIds);
          next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id);
          this.selectedIds = next;
        }
        this.drag = {
          mode: "move", start: point, last: point,
          origins: new Map(this.elements.filter((el) => this.selectedIds.has(el.id)).map((el) => [el.id, { x: el.x, y: el.y }])),
        };
      } else {
        if (!event.shiftKey) this.selectedIds = new Set();
        this.selectionRect = { start: point, end: point };
        this.drag = { mode: "select", start: point, last: point };
      }
      return;
    }
    this.checkpoint();
    const tool = this.tool;
    const base = { x: point.x, y: point.y, strokeColor: this.strokeColor, backgroundColor: this.backgroundColor, strokeWidth: this.strokeWidth, roughness: this.roughness, fillStyle: "hachure" as const };
    let element: WebdrawElement;
    if (tool === "line" || tool === "arrow") {
      element = newLinearElement({ ...base, type: tool, points: [[0, 0], [0, 0]] as any }) as WebdrawElement;
    } else if (tool === "freedraw") {
      element = newFreeDrawElement({ ...base, type: "freedraw", points: [[0, 0]] as any, simulatePressure: true }) as WebdrawElement;
    } else {
      element = newElement({ ...base, type: tool as "rectangle" | "diamond" | "ellipse" }) as WebdrawElement;
    }
    this.elements = [...this.elements, element];
    this.drag = { mode: "draw", start: point, last: point, draftId: element.id, checkpointed: true };
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag) return;
    if (this.drag.mode === "pan") {
      this.pan = { x: this.drag.pan!.x + event.clientX - this.drag.last.x, y: this.drag.pan!.y + event.clientY - this.drag.last.y };
      this.paint();
      return;
    }
    const point = this.scenePoint(event);
    if (this.drag.mode === "erase") { this.eraseAt(point); return; }
    if (this.drag.mode === "select") {
      this.selectionRect = { start: this.drag.start, end: point };
      this.selectWithin(this.selectionRect);
      this.paint();
      return;
    }
    if (this.drag.mode === "move") {
      if (!this.drag.checkpointed) { this.checkpoint(); this.drag.checkpointed = true; }
      const dx = point.x - this.drag.start.x, dy = point.y - this.drag.start.y;
      this.elements = this.elements.map((element) => {
        const origin = this.drag!.origins?.get(element.id);
        return origin ? { ...element, x: origin.x + dx, y: origin.y + dy, version: element.version + 1 } as WebdrawElement : element;
      });
      return;
    }
    const index = this.elements.findIndex((element) => element.id === this.drag!.draftId);
    if (index < 0) return;
    const draft = this.elements[index] as MutableElement;
    let next: MutableElement;
    if (draft.type === "freedraw") {
      const points = [...draft.points, [point.x - draft.x, point.y - draft.y]];
      const xs = points.map(([x]: number[]) => x), ys = points.map(([, y]: number[]) => y);
      next = { ...draft, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), version: draft.version + 1 } as unknown as MutableElement;
    } else if (draft.type === "line" || draft.type === "arrow") {
      const dx = point.x - this.drag.start.x, dy = point.y - this.drag.start.y;
      next = { ...draft, points: [[0, 0], [dx, dy]], width: Math.abs(dx), height: Math.abs(dy), version: draft.version + 1 } as unknown as MutableElement;
    } else {
      next = { ...draft, ...normalizeBounds(this.drag.start, point), version: draft.version + 1 };
    }
    this.elements = [...this.elements.slice(0, index), next as WebdrawElement, ...this.elements.slice(index + 1)];
  };

  private onPointerUp = () => {
    if (!this.drag) return;
    const changed = this.drag.mode === "draw" || this.drag.mode === "move" || this.drag.mode === "erase";
    if (this.drag.mode === "draw") {
      const element = this.elements.find((item) => item.id === this.drag!.draftId);
      if (element && this.isTiny(element)) this.elements = this.elements.filter((item) => item.id !== element.id);
      else if (element) this.selectedIds = new Set([element.id]);
      if (this.tool !== "freedraw") this.tool = "selection";
    }
    this.drag = null;
    this.selectionRect = null;
    if (changed) this.emitChange();
    this.requestUpdate();
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = this.canvas!.getBoundingClientRect();
      const before = { x: (event.clientX - rect.left - this.pan.x) / this.zoom, y: (event.clientY - rect.top - this.pan.y) / this.zoom };
      const zoom = Math.min(30, Math.max(.1, this.zoom * Math.exp(-event.deltaY / 300)));
      this.pan = { x: event.clientX - rect.left - before.x * zoom, y: event.clientY - rect.top - before.y * zoom };
      this.zoom = zoom;
    } else {
      this.pan = { x: this.pan.x - event.deltaX, y: this.pan.y - event.deltaY };
      this.paint();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.editingText) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); this.redo(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && this.selectedIds.size) { event.preventDefault(); this.deleteSelected(); return; }
    if (event.key === "Escape") { this.selectedIds = new Set(); this.tool = "selection"; this.menuOpen = false; this.libraryOpen = false; return; }
    const shortcuts: Record<string, Tool> = { h: "hand", v: "selection", "1": "selection", r: "rectangle", "2": "rectangle", d: "diamond", "3": "diamond", o: "ellipse", "4": "ellipse", a: "arrow", "5": "arrow", l: "line", "6": "line", p: "freedraw", "7": "freedraw", t: "text", "8": "text", e: "eraser", "0": "eraser" };
    if (!event.ctrlKey && !event.metaKey && shortcuts[key]) this.setTool(shortcuts[key]);
  };

  private onTextKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") { this.textDraft = ""; this.editingText = null; }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") (event.target as HTMLTextAreaElement).blur();
  };

  private commitText = () => {
    if (!this.editingText) return;
    const text = this.textDraft.trim();
    if (text) {
      this.checkpoint();
      const element = newTextElement({ x: this.editingText.x, y: this.editingText.y, text, strokeColor: this.strokeColor, fontSize: 20 }) as WebdrawElement;
      this.elements = [...this.elements, element];
      this.selectedIds = new Set([element.id]);
      this.emitChange();
    }
    this.textDraft = "";
    this.editingText = null;
    this.tool = "selection";
  };

  private bounds(element: MutableElement) {
    if (element.points) {
      const xs = element.points.map(([x]: number[]) => element.x + x), ys = element.points.map(([, y]: number[]) => element.y + y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return normalizeBounds({ x: element.x, y: element.y }, { x: element.x + element.width, y: element.y + element.height });
  }

  private hitTest(point: Point) {
    const threshold = 8 / this.zoom;
    return [...this.elements].reverse().find((item) => {
      const box = this.bounds(item as MutableElement);
      return point.x >= box.x - threshold && point.x <= box.x + box.width + threshold && point.y >= box.y - threshold && point.y <= box.y + box.height + threshold;
    });
  }

  private selectWithin(rect: { start: Point; end: Point }) {
    const area = normalizeBounds(rect.start, rect.end);
    this.selectedIds = new Set(this.elements.filter((item) => {
      const box = this.bounds(item as MutableElement);
      return box.x >= area.x && box.y >= area.y && box.x + box.width <= area.x + area.width && box.y + box.height <= area.y + area.height;
    }).map((item) => item.id));
  }

  private eraseAt(point: Point) {
    const hit = this.hitTest(point);
    if (!hit) return;
    if (!this.drag?.checkpointed) { this.checkpoint(); if (this.drag) this.drag.checkpointed = true; }
    this.elements = this.elements.filter((item) => item.id !== hit.id);
    this.selectedIds.delete(hit.id);
    this.selectedIds = new Set(this.selectedIds);
  }

  private isTiny(element: WebdrawElement) {
    const box = this.bounds(element as MutableElement);
    return box.width < 2 && box.height < 2;
  }

  private checkpoint() {
    this.history = [...this.history.slice(-99), structuredClone(this.elements)];
    this.future = [];
  }

  private undo = () => {
    const previous = this.history.at(-1);
    if (!previous) return;
    this.future = [structuredClone(this.elements), ...this.future];
    this.elements = previous;
    this.history = this.history.slice(0, -1);
    this.selectedIds = new Set();
    this.emitChange();
  };

  private redo = () => {
    const next = this.future[0];
    if (!next) return;
    this.history = [...this.history, structuredClone(this.elements)];
    this.elements = next;
    this.future = this.future.slice(1);
    this.selectedIds = new Set();
    this.emitChange();
  };

  private deleteSelected() {
    this.checkpoint();
    this.elements = this.elements.filter((item) => !this.selectedIds.has(item.id));
    this.selectedIds = new Set();
    this.emitChange();
  }

  private setZoom(value: number) { this.zoom = Math.min(30, Math.max(.1, Math.round(value * 10) / 10)); }
  private toggleTheme = () => { this.theme = this.theme === "dark" ? "light" : "dark"; this.strokeColor = this.theme === "dark" ? "#e3e3e8" : "#1b1b1f"; this.menuOpen = false; };

  private updateSelected(patch: Record<string, unknown>) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = this.elements.map((item) => this.selectedIds.has(item.id) ? { ...item, ...patch, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  }

  private onStrokeColor = (event: InputEvent) => { this.strokeColor = (event.target as HTMLInputElement).value; this.updateSelected({ strokeColor: this.strokeColor }); };
  private setBackground(value: string) { this.backgroundColor = value; this.updateSelected({ backgroundColor: value }); }
  private setStrokeWidth(value: number) { this.strokeWidth = value; this.updateSelected({ strokeWidth: value }); }
  private setRoughness(value: number) { this.roughness = value; this.updateSelected({ roughness: value }); }
  private onCanvasColor = (event: InputEvent) => { this.canvasColor = (event.target as HTMLInputElement).value; this.requestUpdate(); };

  private emitChange() {
    this.dispatchEvent(new CustomEvent("webdraw-change", { detail: { elements: this.elements, appState: this.getAppState() }, bubbles: true, composed: true }));
  }

  private saveScene = () => {
    const data = JSON.stringify({ type: "excalidraw", version: 2, source: "webdraw", elements: this.elements, appState: this.getAppState(), files: {} }, null, 2);
    this.download(new Blob([data], { type: "application/json" }), "drawing.excalidraw");
    this.menuOpen = false;
  };

  private openScene = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as WebdrawInitialData;
      if (!Array.isArray(data.elements)) throw new Error("Invalid Excalidraw file");
      this.updateScene(data);
      this.menuOpen = false;
    } catch (error) {
      this.dispatchEvent(new CustomEvent("webdraw-error", { detail: error, bubbles: true, composed: true }));
    } finally { input.value = ""; }
  };

  private exportPng = () => {
    this.paint(false);
    this.canvas?.toBlob((blob) => { if (blob) this.download(blob, "drawing.png"); });
    this.menuOpen = false;
  };

  private download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = this.ownerDocument.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    URL.revokeObjectURL(url);
  }

  private paint(includeSelection = true) {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const win = this.ownerDocument.defaultView;
    const dpr = win?.devicePixelRatio ?? 1;
    const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = this.theme === "dark" && this.canvasColor === "#ffffff" ? "#121212" : this.canvasColor;
    context.fillRect(0, 0, rect.width, rect.height);
    if (this.gridModeEnabled) this.paintGrid(context, rect.width, rect.height);
    context.save();
    context.translate(this.pan.x, this.pan.y);
    context.scale(this.zoom, this.zoom);
    const roughCanvas = rough.canvas(canvas);
    for (const element of this.elements) this.paintElement(context, roughCanvas, element as MutableElement);
    if (includeSelection) this.paintSelection(context);
    context.restore();
  }

  private paintGrid(context: CanvasRenderingContext2D, width: number, height: number) {
    const step = 20 * this.zoom;
    context.save(); context.strokeStyle = this.theme === "dark" ? "#2e2d39" : "#e7e7ed"; context.lineWidth = 1;
    context.beginPath();
    for (let x = ((this.pan.x % step) + step) % step; x < width; x += step) { context.moveTo(x, 0); context.lineTo(x, height); }
    for (let y = ((this.pan.y % step) + step) % step; y < height; y += step) { context.moveTo(0, y); context.lineTo(width, y); }
    context.stroke(); context.restore();
  }

  private paintElement(context: CanvasRenderingContext2D, roughCanvas: ReturnType<typeof rough.canvas>, element: MutableElement) {
    const options = { stroke: element.strokeColor, strokeWidth: element.strokeWidth, roughness: element.roughness, seed: element.seed, fill: element.backgroundColor === "transparent" ? undefined : element.backgroundColor, fillStyle: element.fillStyle };
    context.save(); context.globalAlpha = (element.opacity ?? 100) / 100;
    const centerX = element.x + element.width / 2, centerY = element.y + element.height / 2;
    if (element.angle) { context.translate(centerX, centerY); context.rotate(element.angle); context.translate(-centerX, -centerY); }
    if (element.type === "rectangle") roughCanvas.rectangle(element.x, element.y, element.width, element.height, options);
    else if (element.type === "diamond") roughCanvas.polygon([[element.x + element.width / 2, element.y], [element.x + element.width, element.y + element.height / 2], [element.x + element.width / 2, element.y + element.height], [element.x, element.y + element.height / 2]], options);
    else if (element.type === "ellipse") roughCanvas.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width, element.height, options);
    else if (element.type === "line" || element.type === "arrow") {
      const points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y] as [number, number]);
      roughCanvas.linearPath(points, options);
      if (element.type === "arrow" && points.length > 1) this.paintArrowhead(context, points.at(-2)!, points.at(-1)!, element);
    } else if (element.type === "freedraw") {
      const points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y]);
      const outline = getStroke(points, { size: element.strokeWidth * 4, thinning: .6, smoothing: .5, streamline: .5, simulatePressure: element.simulatePressure });
      if (outline.length) { context.beginPath(); context.moveTo(outline[0][0], outline[0][1]); for (const [x, y] of outline.slice(1)) context.lineTo(x, y); context.closePath(); context.fillStyle = element.strokeColor; context.fill(); }
    } else if (element.type === "text") {
      context.fillStyle = element.strokeColor; context.font = `${element.fontSize}px Virgil, sans-serif`; context.textBaseline = "top";
      String(element.text).split("\n").forEach((line, index) => context.fillText(line, element.x, element.y + index * element.fontSize * (element.lineHeight ?? 1.25)));
    }
    context.restore();
  }

  private paintArrowhead(context: CanvasRenderingContext2D, from: [number, number], to: [number, number], element: MutableElement) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), size = 14 + element.strokeWidth * 2;
    context.save(); context.strokeStyle = element.strokeColor; context.lineWidth = element.strokeWidth; context.lineCap = "round"; context.beginPath();
    context.moveTo(to[0] - Math.cos(angle - Math.PI / 6) * size, to[1] - Math.sin(angle - Math.PI / 6) * size); context.lineTo(to[0], to[1]);
    context.lineTo(to[0] - Math.cos(angle + Math.PI / 6) * size, to[1] - Math.sin(angle + Math.PI / 6) * size); context.stroke(); context.restore();
  }

  private paintSelection(context: CanvasRenderingContext2D) {
    context.save(); context.strokeStyle = "#6965db"; context.lineWidth = 1 / this.zoom; context.setLineDash([]);
    for (const item of this.elements.filter((element) => this.selectedIds.has(element.id))) {
      const box = this.bounds(item as MutableElement), gap = 4 / this.zoom;
      context.strokeRect(box.x - gap, box.y - gap, box.width + gap * 2, box.height + gap * 2);
      context.fillStyle = "#ffffff";
      for (const [x, y] of [[box.x - gap, box.y - gap], [box.x + box.width + gap, box.y - gap], [box.x - gap, box.y + box.height + gap], [box.x + box.width + gap, box.y + box.height + gap]]) { context.fillRect(x - 4 / this.zoom, y - 4 / this.zoom, 8 / this.zoom, 8 / this.zoom); context.strokeRect(x - 4 / this.zoom, y - 4 / this.zoom, 8 / this.zoom, 8 / this.zoom); }
    }
    if (this.selectionRect) { const box = normalizeBounds(this.selectionRect.start, this.selectionRect.end); context.fillStyle = "rgba(105,101,219,.08)"; context.fillRect(box.x, box.y, box.width, box.height); context.setLineDash([4 / this.zoom, 4 / this.zoom]); context.strokeRect(box.x, box.y, box.width, box.height); }
    context.restore();
  }
}

if (!customElements.get("web-draw")) customElements.define("web-draw", WebDraw);

declare global {
  interface HTMLElementTagNameMap { "web-draw": WebDraw; }
}
