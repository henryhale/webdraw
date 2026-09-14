import { LitElement, html, svg, nothing, type PropertyValues, type TemplateResult } from "lit";
import rough from "roughjs/bin/rough";
import { getStroke } from "perfect-freehand";
import pngText from "png-chunk-text";
import encodePng from "png-chunks-encode";
import extractPng from "png-chunks-extract";
import {
  newElement,
  newEmbeddableElement,
  newFreeDrawElement,
  newFrameElement,
  newImageElement,
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
  | "eraser"
  | "frame"
  | "image"
  | "embeddable"
  | "stickynote"
  | "laser";
type Point = { x: number; y: number };
type MutableElement = WebdrawElement & Record<string, any>;
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type TextEdit = Point & { elementId?: string; containerId?: string; fontSize: number; width?: number };
type Drag = {
  mode: "draw" | "move" | "pan" | "select" | "erase" | "resize" | "rotate";
  start: Point;
  last: Point;
  draftId?: string;
  origins?: Map<string, Point>;
  pan?: Point;
  checkpointed?: boolean;
  handle?: ResizeHandle;
  element?: MutableElement;
  startAngle?: number;
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

const svgIcon = (body: TemplateResult, viewBox = "0 0 24 24") => svg`
  <svg aria-hidden="true" focusable="false" viewBox=${viewBox} fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </svg>`;

const icon = (name: Tool | "menu" | "library" | "undo" | "redo" | "help" | "more" | "search" | "export" | "close") => {
  switch (name) {
    case "hand": return svgIcon(svg`<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 5.5v-2a1.5 1.5 0 1 1 3 0V12M14 5.5a1.5 1.5 0 0 1 3 0V12M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.8-2.7L3.7 13.3a1.5 1.5 0 0 1 2.8-1.7L8 13Z"/>`);
    case "selection": return svgIcon(svg`<path d="m6 6 4.15 11.8c.1.27.48.28.67 0L13 13l4.79-2c.28-.12.28-.52 0-.64L6 6Zm7.5 7.5L18 18"/>`);
    case "rectangle": return svgIcon(svg`<rect x="4" y="4" width="16" height="16" rx="2"/>`);
    case "diamond": return svgIcon(svg`<path d="m10.5 20.4-6.9-6.9a2.2 2.2 0 0 1 0-3l6.9-6.9a2.2 2.2 0 0 1 3 0l6.9 6.9a2.2 2.2 0 0 1 0 3l-6.9 6.9a2.2 2.2 0 0 1-3 0Z"/>`);
    case "ellipse": return svgIcon(svg`<circle cx="12" cy="12" r="9"/>`);
    case "arrow": return svgIcon(svg`<path d="M5 12h14m-4-4 4 4-4 4"/>`);
    case "line": return svgIcon(svg`<path d="M5 12h14"/>`);
    case "freedraw": return svgIcon(svg`<path d="m7.6 18.7 9.3-9.3a2.8 2.8 0 0 0-4-4l-9.3 9.3A4 4 0 0 0 2.5 17.5v2h2a4 4 0 0 0 3.1-.8ZM12 6.5l4 4"/>`);
    case "text": return svgIcon(svg`<path d="M4 20h3m7 0h7M7 15h7M10 6h6L6 20m6-16 8 16"/>`);
    case "eraser": return svgIcon(svg`<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20M18 13.3 11.7 7"/>`);
    case "frame": return svgIcon(svg`<path d="M7 3H3v4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>`);
    case "image": return svgIcon(svg`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/>`);
    case "embeddable": return svgIcon(svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9-3 3 3 3m4-6 3 3-3 3"/>`);
    case "stickynote": return svgIcon(svg`<path d="M5 3h14a2 2 0 0 1 2 2v11l-5 5H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M16 21v-5h5"/>`);
    case "laser": return svgIcon(svg`<path d="m5 19 14-14M8 5l1-3m5 4 3-1m2 5 3 1M5 14l-3 1"/>`);
    case "menu": return svgIcon(svg`<path d="M4 6h16M4 12h16M4 18h16"/>`);
    case "library": return svgIcon(svg`<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13"/>`);
    case "undo": return svgIcon(svg`<path d="M9 13 5 9l4-4M5 9h11a4 4 0 0 1 0 8h-2"/>`);
    case "redo": return svgIcon(svg`<path d="m15 13 4-4-4-4m4 4H8a4 4 0 0 0 0 8h2"/>`);
    case "help": return svgIcon(svg`<circle cx="12" cy="12" r="9"/><path d="M12 17v.01M12 14a2 2 0 0 1 1.3-1.9A3 3 0 1 0 9 9"/>`);
    case "more": return svgIcon(svg`<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>`);
    case "search": return svgIcon(svg`<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>`);
    case "export": return svgIcon(svg`<path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/>`);
    case "close": return svgIcon(svg`<path d="m6 6 12 12M18 6 6 18"/>`);
  }
};

const normalizeBounds = (start: Point, end: Point) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const cos = Math.cos(angle), sin = Math.sin(angle), x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
};

const encodeSceneMetadata = (scene: string) => {
  let encoded = "";
  for (const byte of new TextEncoder().encode(scene)) encoded += String.fromCharCode(byte);
  return JSON.stringify({ version: "1", encoding: "bstring", compressed: false, encoded });
};

if (import.meta.env.DEV) {
  const bounds = normalizeBounds({ x: 10, y: 20 }, { x: 2, y: 5 });
  console.assert(bounds.x === 2 && bounds.y === 5 && bounds.width === 8 && bounds.height === 15);
  const rotated = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
  console.assert(Math.abs(rotated.x) < 1e-10 && Math.abs(rotated.y - 1) < 1e-10);
  console.assert(JSON.parse(encodeSceneMetadata("✓")).encoded.length === 3);
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
    moreToolsOpen: { state: true },
    libraryOpen: { state: true },
    dialog: { state: true },
    searchQuery: { state: true },
    editingText: { state: true },
    selectedIds: { state: true },
    contextMenu: { state: true },
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
  moreToolsOpen = false;
  libraryOpen = false;
  dialog: "export" | "help" | "search" | null = null;
  searchQuery = "";
  editingText: TextEdit | null = null;
  selectedIds = new Set<string>();
  contextMenu: Point | null = null;

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
  private fillStyle: "hachure" | "cross-hatch" | "solid" | "zigzag" = "hachure";
  private strokeStyle: "solid" | "dashed" | "dotted" = "solid";
  private opacity = 100;
  private textDraft = "";
  private exportScale = 1;
  private exportBackground = true;
  private exportDarkMode = false;
  private exportEmbedScene = false;
  private exportSelectionOnly = false;
  private exportPadding = 10;
  private imageCache = new Map<string, HTMLImageElement>();
  private clipboard: WebdrawElement[] = [];

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
    if (this.dialog === "export") this.paintExportPreview();
    if (this.editingText) {
      const area = this.querySelector<HTMLTextAreaElement>(".webdraw-text-editor");
      area?.focus();
      if (area) { area.style.height = "0"; area.style.height = `${area.scrollHeight}px`; }
    }
    if (this.dialog === "search") this.querySelector<HTMLInputElement>(".search-menu input")?.focus();
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
          @dblclick=${this.onDoubleClick} @contextmenu=${this.onContextMenu} @wheel=${this.onWheel}></canvas>
        <div class="webdraw-embeds">${this.elements.filter((item) => item.type === "embeddable").map((item) => {
          const element = item as MutableElement, url = this.getEmbedUrl(element);
          return url ? html`<iframe title="Web embed" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src=${url}
            style=${`left:${element.x * this.zoom + this.pan.x}px;top:${element.y * this.zoom + this.pan.y}px;width:${element.width * this.zoom}px;height:${element.height * this.zoom}px;transform:rotate(${element.angle ?? 0}rad)`}></iframe>` : nothing;
        })}</div>

        <div class="layer-ui__wrapper">
          ${this.zenModeEnabled ? nothing : html`
            <div class="FixedSideContainer FixedSideContainer_side_top">
              <div class="App-menu App-menu_top">
                <div class="App-menu_top__left">
                  <button class="webdraw-floating ToolIcon ToolIcon_type_button" aria-label="Open menu"
                    title="Open menu" @click=${() => { this.menuOpen = !this.menuOpen; this.libraryOpen = false; this.moreToolsOpen = false; }}>
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
                          <button class="ToolIcon ToolIcon_type_toggle ${this.moreToolsOpen ? "ToolIcon--checked" : ""}"
                            title="More tools" aria-label="More tools" aria-expanded=${this.moreToolsOpen}
                            @click=${() => { this.moreToolsOpen = !this.moreToolsOpen; this.menuOpen = false; this.libraryOpen = false; }}>
                            <span class="ToolIcon__icon">${icon("more")}</span>
                          </button>
                        </div>
                        ${this.moreToolsOpen ? this.renderMoreTools() : nothing}
                      </div>
                    </div>
                  </section>`}

                <div class="layer-ui__wrapper__top-right">
                  <button class="library-button" @click=${() => { this.libraryOpen = !this.libraryOpen; this.menuOpen = false; this.moreToolsOpen = false; }}>
                    ${icon("library")}<span>Library</span>
                  </button>
                  ${this.libraryOpen ? html`
                    <aside class="Island library-panel">
                      <header><strong>Library</strong><button aria-label="Close library" @click=${() => this.libraryOpen = false}>×</button></header>
                      <input class="library-search" type="search" placeholder="Search library" />
                      <div class="library-empty">Select an item on canvas to add it here, or install a library from the public repository, below.</div>
                      <a class="library-browse" href="https://libraries.excalidraw.com" target="_blank" rel="noopener">Browse libraries</a>
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
              <button class="webdraw-floating help-button" title="Help" aria-label="Help" @click=${() => this.dialog = "help"}>${icon("help")}</button>
            </div>
          </div>
          ${!this.elements.length && !this.viewModeEnabled ? this.renderWelcome() : nothing}
        </div>

        ${this.dialog ? this.renderDialog() : nothing}
        ${this.contextMenu ? this.renderContextMenu() : nothing}
        ${this.editingText ? html`
          <textarea class="webdraw-text-editor" aria-label="Text" placeholder="Type something" rows="1" .value=${this.textDraft}
            style=${`left:${this.editingText.x * this.zoom + this.pan.x}px;top:${this.editingText.y * this.zoom + this.pan.y}px;font-size:${this.editingText.fontSize * this.zoom}px;${this.editingText.width ? `width:${Math.max(64, this.editingText.width * this.zoom)}px` : ""}`}
            @input=${this.onTextInput}
            @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
            @keydown=${this.onTextKeyDown} @blur=${this.commitText}></textarea>` : nothing}
        <input class="scene-input" type="file" accept="application/json,.excalidraw" @change=${this.openScene} />
        <input class="image-input" type="file" accept="image/*" @change=${this.openImage} />
      </div>`;
  }

  private renderMenu() {
    return html`
      <div class="Island dropdown-menu" role="menu">
        <button role="menuitem" @click=${() => this.querySelector<HTMLInputElement>(".scene-input")?.click()}>Open</button>
        <button role="menuitem" @click=${this.saveScene}>Save to current file</button>
        <button role="menuitem" @click=${this.saveScene}>Save to...</button>
        <button role="menuitem" @click=${() => { this.dialog = "export"; this.menuOpen = false; }}>Export image...</button>
        <button role="menuitem" @click=${() => { this.dialog = "search"; this.menuOpen = false; }}>Find on canvas <kbd>Ctrl+F</kbd></button>
        <button role="menuitem" @click=${() => { this.dialog = "help"; this.menuOpen = false; }}>Help <kbd>?</kbd></button>
        <span class="dropdown-separator"></span>
        <button role="menuitem" @click=${this.confirmReset}>Reset the canvas</button>
        <span class="dropdown-separator"></span>
        <div class="dropdown-heading">Excalidraw links</div>
        <a role="menuitem" href="https://plus.excalidraw.com" target="_blank" rel="noopener">Excalidraw+</a>
        <a role="menuitem" href="https://github.com/excalidraw/excalidraw" target="_blank" rel="noopener">GitHub</a>
        <a role="menuitem" href="https://discord.gg/UexuTaE" target="_blank" rel="noopener">Discord</a>
        <span class="dropdown-separator"></span>
        <button role="menuitemcheckbox" aria-checked=${this.gridModeEnabled} @click=${() => this.gridModeEnabled = !this.gridModeEnabled}>Grid mode <span>${this.gridModeEnabled ? "✓" : ""}</span></button>
        <button role="menuitem" @click=${this.toggleTheme}>${this.theme === "dark" ? "Light" : "Dark"} mode</button>
        <label class="canvas-color">Canvas background <input type="color" .value=${this.canvasColor} @input=${this.onCanvasColor}></label>
      </div>`;
  }

  private renderMoreTools() {
    const item = (tool: Tool, label: string, shortcut = "") => html`
      <button role="menuitem" @click=${() => { this.setTool(tool); this.moreToolsOpen = false; }}>
        ${icon(tool)}<span>${label}</span>${shortcut ? html`<kbd>${shortcut}</kbd>` : nothing}
      </button>`;
    return html`
      <div class="Island extra-tools-menu" role="menu">
        <button role="menuitem" @click=${() => { this.querySelector<HTMLInputElement>(".image-input")?.click(); this.moreToolsOpen = false; }}>${icon("image")}<span>Insert image</span><kbd>9</kbd></button>
        ${item("frame", "Frame tool", "F")}
        ${item("embeddable", "Web Embed")}
        ${item("stickynote", "Sticky note")}
        ${item("laser", "Laser pointer", "K")}
        <span class="dropdown-separator"></span>
        <div class="dropdown-heading">Generate</div>
        <button role="menuitem" @click=${() => this.dispatchEvent(new CustomEvent("webdraw-text-to-diagram", { bubbles: true, composed: true }))}><span>Text to diagram</span><kbd>AI</kbd></button>
        <button role="menuitem" @click=${() => this.dispatchEvent(new CustomEvent("webdraw-mermaid", { bubbles: true, composed: true }))}><span>Mermaid to Excalidraw</span></button>
      </div>`;
  }

  private renderWelcome() {
    return html`
      <div class="welcome-screen-center">
        <div class="welcome-screen-center__logo"><span class="welcome-logo-mark">E</span><strong>Excalidraw</strong></div>
        <div class="welcome-screen-center__heading">Diagrams. Made. Simple.</div>
        <div class="welcome-screen-menu">
          <button class="welcome-screen-menu-item" @click=${() => this.querySelector<HTMLInputElement>(".scene-input")?.click()}><span>↥</span><span>Open</span><kbd>Ctrl+O</kbd></button>
          <button class="welcome-screen-menu-item" @click=${() => this.dialog = "help"}>${icon("help")}<span>Help</span><kbd>?</kbd></button>
        </div>
      </div>
      <div class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu">↖ <span>Export, preferences, and more...</span></div>
      <div class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar"><span>Pick a tool &amp; Start drawing!</span> ↑</div>
      <div class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help"><span>Shortcuts &amp; help</span> ↘</div>`;
  }

  private renderDialog() {
    const close = () => this.dialog = null;
    if (this.dialog === "export") return html`
      <div class="Modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div class="Modal__background" @click=${close}></div>
        <div class="Modal__content ImageExportModal">
          <header><h2 id="export-title">Export image</h2><button class="modal-close" @click=${close} aria-label="Close">${icon("close")}</button></header>
          <div class="export-preview"><canvas aria-label="Export preview"></canvas></div>
          <div class="export-settings">
            <label><span>Background</span><input type="checkbox" .checked=${this.exportBackground} @change=${(event: Event) => { this.exportBackground = (event.target as HTMLInputElement).checked; this.requestUpdate(); }}></label>
            ${this.selectedIds.size ? html`<label><span>Only selected</span><input type="checkbox" .checked=${this.exportSelectionOnly} @change=${(event: Event) => { this.exportSelectionOnly = (event.target as HTMLInputElement).checked; this.requestUpdate(); }}></label>` : nothing}
            <label><span>Dark mode</span><input type="checkbox" .checked=${this.exportDarkMode} @change=${(event: Event) => { this.exportDarkMode = (event.target as HTMLInputElement).checked; this.requestUpdate(); }}></label>
            <label><span>Embed scene</span><input type="checkbox" .checked=${this.exportEmbedScene} @change=${(event: Event) => this.exportEmbedScene = (event.target as HTMLInputElement).checked}></label>
            <label><span>Scale</span><span class="segmented">${[1, 2, 3].map((scale) => html`<button class=${this.exportScale === scale ? "selected" : ""} @click=${() => { this.exportScale = scale; this.requestUpdate(); }}>${scale}×</button>`)}</span></label>
            <label><span>Padding</span><input class="export-padding" type="number" min="0" max="100" .value=${String(this.exportPadding)} @change=${(event: Event) => { this.exportPadding = Math.max(0, Number((event.target as HTMLInputElement).value)); this.requestUpdate(); }}></label>
          </div>
          <div class="export-actions">
            <button title="Export to PNG" @click=${this.exportPng}>PNG</button>
            <button title="Export to SVG" @click=${this.exportSvg}>SVG</button>
            <button title="Copy PNG to clipboard" @click=${this.copyPng}>Copy to clipboard</button>
          </div>
        </div>
      </div>`;
    if (this.dialog === "search") {
      const query = this.searchQuery.trim().toLowerCase();
      const results = this.elements.filter((item) => (item.type === "text" && String((item as MutableElement).text).toLowerCase().includes(query)) || (item.type === "frame" && String((item as MutableElement).name ?? "Frame").toLowerCase().includes(query)));
      return html`
        <div class="search-menu Island" role="dialog" aria-label="Find on canvas">
          ${icon("search")}<input type="search" autofocus placeholder="Find text on canvas..." .value=${this.searchQuery} @input=${(event: InputEvent) => this.searchQuery = (event.target as HTMLInputElement).value} />
          <button aria-label="Close" @click=${close}>${icon("close")}</button>
          ${query ? html`<div class="search-results">${results.length ? results.map((item) => html`<button @click=${() => this.focusElement(item)}><span>${item.type === "frame" ? "Frame" : "Text"}</span><strong>${item.type === "frame" ? ((item as MutableElement).name ?? "Frame") : (item as MutableElement).text}</strong></button>`) : html`<p>No matches found...</p>`}</div>` : nothing}
        </div>`;
    }
    return html`
      <div class="Modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div class="Modal__background" @click=${close}></div>
        <div class="Modal__content help-dialog">
          <header><h2 id="help-title">Help</h2><button class="modal-close" @click=${close} aria-label="Close">${icon("close")}</button></header>
          <h3>Tools</h3>
          <div class="shortcut-grid">${TOOL_META.map(([tool, title, key]) => html`<span>${icon(tool)} ${title.split(" (")[0]}</span><kbd>${key || "H"}</kbd>`)}</div>
          <h3>Editor</h3>
          <div class="shortcut-grid"><span>Undo</span><kbd>Ctrl+Z</kbd><span>Redo</span><kbd>Ctrl+Shift+Z</kbd><span>Edit text / add label</span><kbd>Double-click</kbd><span>Delete selection</span><kbd>Delete</kbd><span>Find on canvas</span><kbd>Ctrl+F</kbd></div>
        </div>
      </div>`;
  }

  private renderContextMenu() {
    const grouped = this.elements.some((item) => this.selectedIds.has(item.id) && item.groupIds.length);
    const locked = this.elements.some((item) => this.selectedIds.has(item.id) && item.locked);
    const action = (callback: () => void) => { callback(); this.contextMenu = null; };
    return html`
      <div class="Island context-menu" role="menu" style=${`left:${this.contextMenu!.x}px;top:${this.contextMenu!.y}px`}>
        <button role="menuitem" @click=${() => action(this.copySelected)}>Copy <kbd>Ctrl+C</kbd></button>
        <button role="menuitem" @click=${() => action(this.duplicateSelected)}>Duplicate <kbd>Ctrl+D</kbd></button>
        <span class="dropdown-separator"></span>
        <button role="menuitem" @click=${() => action(this.sendBackward)}>Send backward</button>
        <button role="menuitem" @click=${() => action(this.bringForward)}>Bring forward</button>
        ${this.selectedIds.size > 1 || grouped ? html`<button role="menuitem" @click=${() => action(grouped ? this.ungroupSelected : this.groupSelected)}>${grouped ? "Ungroup selection" : "Group selection"}</button>` : nothing}
        <button role="menuitem" @click=${() => action(this.setSelectedLink)}>Add link</button>
        <button role="menuitem" @click=${() => action(() => this.updateSelected({ locked: !locked }))}>${locked ? "Unlock" : "Lock"}</button>
        <span class="dropdown-separator"></span>
        <button class="danger" role="menuitem" @click=${() => action(() => this.deleteSelected())}>Delete <kbd>Delete</kbd></button>
      </div>`;
  }

  private renderProperties() {
    if (this.viewModeEnabled || (this.tool === "selection" && !this.selectedIds.size) || this.tool === "hand" || this.tool === "eraser") return nothing;
    const locked = this.elements.some((item) => this.selectedIds.has(item.id) && item.locked);
    return html`
      <div class="Island selected-shape-actions">
        <label>Stroke <input type="color" .value=${this.strokeColor} @input=${this.onStrokeColor}></label>
        <label>Background <span class="color-row"><button class=${this.backgroundColor === "transparent" ? "selected" : ""} @click=${() => this.setBackground("transparent")}>×</button><input type="color" value="#a5d8ff" @input=${(event: InputEvent) => this.setBackground((event.target as HTMLInputElement).value)}></span></label>
        <label>Fill <span class="segmented wide">${(["hachure", "cross-hatch", "solid"] as const).map((style) => html`<button title=${style} class=${this.fillStyle === style ? "selected" : ""} @click=${() => this.setFillStyle(style)}>${style === "hachure" ? "╱" : style === "cross-hatch" ? "╳" : "■"}</button>`)}</span></label>
        <label>Stroke width <span class="segmented">${[1, 2, 4].map((width) => html`<button class=${this.strokeWidth === width ? "selected" : ""} @click=${() => this.setStrokeWidth(width)}>${width}</button>`)}</span></label>
        <label>Stroke style <span class="segmented wide">${(["solid", "dashed", "dotted"] as const).map((style) => html`<button title=${style} class=${this.strokeStyle === style ? "selected" : ""} @click=${() => this.setStrokeStyle(style)}>${style === "solid" ? "━" : style === "dashed" ? "┅" : "┈"}</button>`)}</span></label>
        <label>Sloppiness <span class="segmented">${[0, 1, 2].map((value) => html`<button class=${this.roughness === value ? "selected" : ""} @click=${() => this.setRoughness(value)}>${value + 1}</button>`)}</span></label>
        <label>Opacity <span class="range-row"><input type="range" min="0" max="100" .value=${String(this.opacity)} @change=${this.onOpacity}><output>${this.opacity}</output></span></label>
        ${this.selectedIds.size ? html`
          <label>Actions <span class="action-row"><button @click=${this.duplicateSelected}>Duplicate</button><button @click=${this.sendBackward}>↓</button><button @click=${this.bringForward}>↑</button><button @click=${() => this.updateSelected({ locked: !locked })}>${locked ? "Unlock" : "Lock"}</button><button class="danger" @click=${this.deleteSelected}>Delete</button></span></label>` : nothing}
      </div>`;
  }

  private setTool(tool: Tool) {
    if (this.viewModeEnabled) return;
    this.tool = tool;
    if (tool !== "selection") this.selectedIds = new Set();
    this.focus();
  }

  private scenePoint(event: Pick<MouseEvent, "clientX" | "clientY">): Point {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: (event.clientX - rect.left - this.pan.x) / this.zoom, y: (event.clientY - rect.top - this.pan.y) / this.zoom };
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.viewModeEnabled || (event.button !== 0 && event.button !== 1) || this.editingText) return;
    this.focus();
    this.menuOpen = false;
    this.moreToolsOpen = false;
    this.libraryOpen = false;
    this.contextMenu = null;
    this.canvas!.setPointerCapture(event.pointerId);
    const point = this.scenePoint(event);
    if (this.tool === "hand" || event.button === 1 || event.altKey) {
      this.drag = { mode: "pan", start: point, last: { x: event.clientX, y: event.clientY }, pan: { ...this.pan } };
      return;
    }
    if (this.tool === "text") {
      this.startTextEditing(point);
      return;
    }
    if (this.tool === "eraser") {
      this.drag = { mode: "erase", start: point, last: point };
      this.eraseAt(point);
      return;
    }
    if (this.tool === "selection") {
      const transform = this.selectionHandleAt(point);
      if (transform) {
        const element = structuredClone(this.elements.find((item) => this.selectedIds.has(item.id))!) as MutableElement;
        this.checkpoint();
        const box = this.bounds(element), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        this.drag = transform === "rotate"
          ? { mode: "rotate", start: point, last: point, element, startAngle: Math.atan2(point.y - center.y, point.x - center.x) }
          : { mode: "resize", start: point, last: point, element, handle: transform };
        return;
      }
      const hit = this.hitTest(point);
      if (hit) {
        if ((event.ctrlKey || event.metaKey) && hit.link) { const url = this.safeUrl(hit.link); if (url) this.ownerDocument.defaultView?.open(url, "_blank", "noopener"); return; }
        if (!event.shiftKey && !this.selectedIds.has(hit.id)) this.selectedIds = this.groupSelectionFor(hit);
        else if (event.shiftKey) {
          const next = new Set(this.selectedIds);
          next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id);
          this.selectedIds = next;
        }
        if ([...this.selectedIds].every((id) => this.elements.find((element) => element.id === id)?.locked)) return;
        const movingIds = this.movingElementIds();
        this.drag = {
          mode: "move", start: point, last: point,
          origins: new Map(this.elements.filter((el) => movingIds.has(el.id)).map((el) => [el.id, { x: el.x, y: el.y }])),
        };
        this.syncStyleFromElement(hit as MutableElement);
      } else {
        if (!event.shiftKey) this.selectedIds = new Set();
        this.selectionRect = { start: point, end: point };
        this.drag = { mode: "select", start: point, last: point };
      }
      return;
    }
    const tool = this.tool;
    if (tool !== "laser") this.checkpoint();
    const base = { x: point.x, y: point.y, strokeColor: this.strokeColor, backgroundColor: this.backgroundColor, strokeWidth: this.strokeWidth, strokeStyle: this.strokeStyle, roughness: this.roughness, opacity: this.opacity, fillStyle: this.fillStyle };
    let element: WebdrawElement;
    if (tool === "line" || tool === "arrow") {
      element = newLinearElement({ ...base, type: tool, points: [[0, 0], [0, 0]] as any }) as WebdrawElement;
    } else if (tool === "freedraw" || tool === "laser") {
      element = newFreeDrawElement({ ...base, type: "freedraw", strokeColor: tool === "laser" ? "#e03131" : base.strokeColor, points: [[0, 0]] as any, simulatePressure: true, customData: tool === "laser" ? { webdrawLaser: true } : undefined }) as WebdrawElement;
    } else if (tool === "frame") {
      element = newFrameElement({ ...base, name: null as any }) as WebdrawElement;
    } else if (tool === "embeddable") {
      element = newEmbeddableElement({ ...base, type: "embeddable" }) as WebdrawElement;
    } else if (tool === "stickynote") {
      element = newElement({ ...base, type: "rectangle", backgroundColor: "#fff3bf", fillStyle: "solid", customData: { webdrawSticky: true } }) as WebdrawElement;
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
      this.requestUpdate();
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
    if (this.drag.mode === "rotate") {
      const original = this.drag.element!;
      const box = this.bounds(original), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      let angle = original.angle + Math.atan2(point.y - center.y, point.x - center.x) - this.drag.startAngle!;
      if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      this.replaceElement({ ...original, angle, version: original.version + 1 } as WebdrawElement);
      return;
    }
    if (this.drag.mode === "resize") {
      this.replaceElement(this.resizeElement(this.drag.element!, this.drag.handle!, point, event.shiftKey));
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
    let changed = this.drag.mode === "draw" || this.drag.mode === "move" || this.drag.mode === "erase" || this.drag.mode === "resize" || this.drag.mode === "rotate";
    if (this.drag.mode === "draw") {
      const element = this.elements.find((item) => item.id === this.drag!.draftId);
      const laser = !!(element as MutableElement | undefined)?.customData?.webdrawLaser;
      if (element && this.isTiny(element)) this.elements = this.elements.filter((item) => item.id !== element.id);
      else if (element && !laser) this.selectedIds = new Set([element.id]);
      if (element?.type === "embeddable") {
        const url = this.ownerDocument.defaultView?.prompt("Paste a URL to embed", "https://");
        if (url) this.replaceElement({ ...element, link: url, customData: { ...(element.customData ?? {}), embedUrl: url } } as WebdrawElement);
      }
      if (element?.type === "frame") {
        const frameBox = this.bounds(element as MutableElement);
        this.elements = this.elements.map((item) => {
          if (item.id === element.id || item.frameId) return item;
          const box = this.bounds(item as MutableElement);
          return box.x >= frameBox.x && box.y >= frameBox.y && box.x + box.width <= frameBox.x + frameBox.width && box.y + box.height <= frameBox.y + frameBox.height
            ? { ...item, frameId: element.id, version: item.version + 1 } as WebdrawElement : item;
        });
      }
      if (laser) {
        changed = false;
        const id = element!.id;
        this.ownerDocument.defaultView?.setTimeout(() => { this.elements = this.elements.filter((item) => item.id !== id); this.requestUpdate(); }, 650);
      }
      if (this.tool !== "freedraw" && this.tool !== "laser") this.tool = "selection";
    }
    this.drag = null;
    this.selectionRect = null;
    if (changed) this.emitChange();
    this.requestUpdate();
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (this.viewModeEnabled) return;
    event.preventDefault();
    const point = this.scenePoint(event as unknown as PointerEvent);
    const hit = this.hitTest(point);
    if (hit?.type === "text") this.startTextEditing(point, hit as MutableElement);
    else if (hit && !["freedraw", "image", "frame"].includes(hit.type)) {
      const labelId = hit.boundElements?.find((binding) => binding.type === "text")?.id;
      const label = labelId ? this.elements.find((item) => item.id === labelId) as MutableElement | undefined : undefined;
      label ? this.startTextEditing(point, label) : this.startTextEditing(point, undefined, hit.id);
    }
    else if (!hit) this.startTextEditing(point);
  };

  private onContextMenu = (event: MouseEvent) => {
    if (this.viewModeEnabled) return;
    event.preventDefault();
    const hit = this.hitTest(this.scenePoint(event));
    if (hit && !this.selectedIds.has(hit.id)) this.selectedIds = this.groupSelectionFor(hit);
    if (!this.selectedIds.size) return;
    const rect = this.getBoundingClientRect();
    this.contextMenu = { x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 240)), y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 300)) };
    this.menuOpen = false;
    this.moreToolsOpen = false;
    this.libraryOpen = false;
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
      this.requestUpdate();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.editingText) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "f") { event.preventDefault(); this.dialog = "search"; return; }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "e") { event.preventDefault(); this.dialog = "export"; return; }
    if ((event.ctrlKey || event.metaKey) && key === "o") { event.preventDefault(); this.querySelector<HTMLInputElement>(".scene-input")?.click(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "a") { event.preventDefault(); this.selectedIds = new Set(this.elements.map((item) => item.id)); return; }
    if ((event.ctrlKey || event.metaKey) && key === "c" && this.selectedIds.size) { event.preventDefault(); this.copySelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "x" && this.selectedIds.size) { event.preventDefault(); this.copySelected(); this.deleteSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "v" && this.clipboard.length) { event.preventDefault(); this.pasteClipboard(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "d" && this.selectedIds.size) { event.preventDefault(); this.duplicateSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "g" && this.selectedIds.size > 1) { event.preventDefault(); event.shiftKey ? this.ungroupSelected() : this.groupSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); this.redo(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && this.selectedIds.size) { event.preventDefault(); this.deleteSelected(); return; }
    if (event.key.startsWith("Arrow") && this.selectedIds.size) { event.preventDefault(); this.nudgeSelected(event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0, event.shiftKey ? 10 : 1); return; }
    if (event.key === "?") { this.dialog = "help"; return; }
    if (event.key === "Escape") { this.selectedIds = new Set(); this.tool = "selection"; this.menuOpen = false; this.moreToolsOpen = false; this.libraryOpen = false; this.dialog = null; return; }
    if (event.key === "Enter" && this.selectedIds.size === 1) {
      const selected = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement;
      if (selected.type === "text") this.startTextEditing({ x: selected.x, y: selected.y }, selected);
      else {
        const labelId = selected.boundElements?.find((binding) => binding.type === "text")?.id;
        const label = labelId ? this.elements.find((item) => item.id === labelId) as MutableElement | undefined : undefined;
        label ? this.startTextEditing({ x: label.x, y: label.y }, label) : this.startTextEditing({ x: selected.x, y: selected.y }, undefined, selected.id);
      }
      return;
    }
    if (key === "9") { this.querySelector<HTMLInputElement>(".image-input")?.click(); return; }
    const shortcuts: Record<string, Tool> = { h: "hand", v: "selection", "1": "selection", r: "rectangle", "2": "rectangle", d: "diamond", "3": "diamond", o: "ellipse", "4": "ellipse", a: "arrow", "5": "arrow", l: "line", "6": "line", p: "freedraw", "7": "freedraw", t: "text", "8": "text", e: "eraser", "0": "eraser", f: "frame", k: "laser", q: "stickynote" };
    if (!event.ctrlKey && !event.metaKey && shortcuts[key]) this.setTool(shortcuts[key]);
  };

  private onTextKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") { this.textDraft = ""; this.editingText = null; }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") (event.target as HTMLTextAreaElement).blur();
  };

  private onTextInput = (event: InputEvent) => {
    const area = event.target as HTMLTextAreaElement;
    this.textDraft = area.value;
    area.style.height = "0";
    area.style.height = `${area.scrollHeight}px`;
    if (!this.editingText?.containerId) area.style.width = `${Math.max(64, area.scrollWidth + 2)}px`;
  };

  private commitText = () => {
    if (!this.editingText) return;
    const edit = this.editingText;
    const text = this.textDraft.trimEnd();
    if (text.trim()) {
      this.checkpoint();
      const existing = edit.elementId ? this.elements.find((item) => item.id === edit.elementId) as MutableElement | undefined : undefined;
      const fresh = newTextElement({ x: edit.x, y: edit.y, text, strokeColor: existing?.strokeColor ?? this.strokeColor, fontSize: edit.fontSize, containerId: edit.containerId ?? null, textAlign: edit.containerId ? "center" : "left", verticalAlign: edit.containerId ? "middle" : "top" }) as MutableElement;
      let element = existing ? { ...existing, text, originalText: text, width: fresh.width, height: fresh.height, version: existing.version + 1 } as WebdrawElement : fresh as WebdrawElement;
      if (edit.containerId) {
        const container = this.elements.find((item) => item.id === edit.containerId)!;
        element = { ...element, x: container.x + (container.width - fresh.width) / 2, y: container.y + (container.height - fresh.height) / 2, containerId: container.id } as WebdrawElement;
        if (!existing) this.elements = this.elements.map((item) => item.id === container.id ? { ...item, boundElements: [...(item.boundElements ?? []), { id: element.id, type: "text" }] } as WebdrawElement : item);
      }
      this.elements = existing ? this.elements.map((item) => item.id === existing.id ? element : item) : [...this.elements, element];
      this.selectedIds = new Set([element.id]);
      this.emitChange();
    } else if (edit.elementId) {
      this.selectedIds = new Set([edit.elementId]);
      this.deleteSelected();
    }
    this.textDraft = "";
    this.editingText = null;
    this.tool = "selection";
  };

  private startTextEditing(point: Point, element?: MutableElement, containerId?: string) {
    if (element) {
      this.editingText = { x: element.x, y: element.y, fontSize: element.fontSize ?? 20, width: element.width, elementId: element.id, containerId: element.containerId ?? undefined };
      this.textDraft = element.text ?? "";
      this.selectedIds = new Set([element.id]);
    } else if (containerId) {
      const container = this.elements.find((item) => item.id === containerId)!;
      this.editingText = { x: container.x + 8, y: container.y + container.height / 2 - 12, width: Math.max(64, container.width - 16), fontSize: 20, containerId };
      this.textDraft = "";
      this.selectedIds = new Set([containerId]);
    } else {
      this.editingText = { ...point, fontSize: 20 };
      this.textDraft = "";
    }
  }

  private replaceElement(element: WebdrawElement) {
    const mutable = element as MutableElement;
    const labelIds = new Set(element.boundElements?.filter((binding) => binding.type === "text").map((binding) => binding.id));
    this.elements = this.elements.map((item) => {
      if (item.id === element.id) return element;
      if (!labelIds.has(item.id)) return item;
      return { ...item, x: element.x + (element.width - item.width) / 2, y: element.y + (element.height - item.height) / 2, angle: mutable.angle ?? 0, version: item.version + 1 } as WebdrawElement;
    });
  }

  private syncStyleFromElement(element: MutableElement) {
    this.strokeColor = element.strokeColor ?? this.strokeColor;
    this.backgroundColor = element.backgroundColor ?? this.backgroundColor;
    this.strokeWidth = element.strokeWidth ?? this.strokeWidth;
    this.fillStyle = element.fillStyle ?? this.fillStyle;
    this.strokeStyle = element.strokeStyle ?? this.strokeStyle;
    this.roughness = element.roughness ?? this.roughness;
    this.opacity = element.opacity ?? this.opacity;
  }

  private selectionHandleAt(point: Point): ResizeHandle | "rotate" | null {
    if (this.selectedIds.size !== 1) return null;
    const element = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement | undefined;
    if (!element || element.locked) return null;
    const box = this.bounds(element), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const local = rotatePoint(point, center, -(element.angle ?? 0));
    const gap = 4 / this.zoom, threshold = 9 / this.zoom;
    const handles: [ResizeHandle | "rotate", Point][] = [
      ["nw", { x: box.x - gap, y: box.y - gap }], ["n", { x: center.x, y: box.y - gap }], ["ne", { x: box.x + box.width + gap, y: box.y - gap }],
      ["e", { x: box.x + box.width + gap, y: center.y }], ["se", { x: box.x + box.width + gap, y: box.y + box.height + gap }],
      ["s", { x: center.x, y: box.y + box.height + gap }], ["sw", { x: box.x - gap, y: box.y + box.height + gap }], ["w", { x: box.x - gap, y: center.y }],
      ["rotate", { x: center.x, y: box.y - gap - 24 / this.zoom }],
    ];
    return handles.find(([, handle]) => Math.hypot(local.x - handle.x, local.y - handle.y) <= threshold)?.[0] ?? null;
  }

  private resizeElement(original: MutableElement, handle: ResizeHandle, point: Point, keepRatio: boolean): WebdrawElement {
    const old = this.bounds(original), center = { x: old.x + old.width / 2, y: old.y + old.height / 2 };
    const local = rotatePoint(point, center, -(original.angle ?? 0));
    let left = old.x, top = old.y, right = old.x + old.width, bottom = old.y + old.height;
    if (handle.includes("w")) left = local.x;
    if (handle.includes("e")) right = local.x;
    if (handle.includes("n")) top = local.y;
    if (handle.includes("s")) bottom = local.y;
    if (keepRatio && old.width && old.height) {
      const ratio = old.width / old.height;
      if (Math.abs(right - left) / Math.max(1, Math.abs(bottom - top)) > ratio) {
        const height = Math.abs(right - left) / ratio;
        handle.includes("n") ? top = bottom - height : bottom = top + height;
      } else {
        const width = Math.abs(bottom - top) * ratio;
        handle.includes("w") ? left = right - width : right = left + width;
      }
    }
    const localBounds = normalizeBounds({ x: left, y: top }, { x: right, y: bottom });
    localBounds.width = Math.max(5, localBounds.width); localBounds.height = Math.max(5, localBounds.height);
    const localCenter = { x: localBounds.x + localBounds.width / 2, y: localBounds.y + localBounds.height / 2 };
    const worldCenter = rotatePoint(localCenter, center, original.angle ?? 0);
    const next = { x: worldCenter.x - localBounds.width / 2, y: worldCenter.y - localBounds.height / 2, width: localBounds.width, height: localBounds.height };
    if (original.points?.length) {
      const sx = next.width / Math.max(old.width, 1), sy = next.height / Math.max(old.height, 1);
      const points = original.points.map(([x, y]: number[]) => [((original.x + x) - old.x) * sx, ((original.y + y) - old.y) * sy]);
      return { ...original, ...next, points, version: original.version + 1 } as unknown as WebdrawElement;
    }
    const fontSize = original.type === "text" ? Math.max(1, original.fontSize * (next.height / Math.max(old.height, 1))) : original.fontSize;
    return { ...original, ...next, ...(fontSize ? { fontSize } : {}), version: original.version + 1 } as WebdrawElement;
  }

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
      const element = item as MutableElement, box = this.bounds(element), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const local = rotatePoint(point, center, -(element.angle ?? 0));
      return local.x >= box.x - threshold && local.x <= box.x + box.width + threshold && local.y >= box.y - threshold && local.y <= box.y + box.height + threshold;
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
    const deletedIds = this.removeElements(new Set([hit.id]));
    for (const id of deletedIds) this.selectedIds.delete(id);
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
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.removeElements(new Set(this.selectedIds));
    this.selectedIds = new Set();
    this.emitChange();
  }

  private removeElements(deletedIds: Set<string>) {
    for (const element of this.elements.filter((item) => deletedIds.has(item.id))) {
      for (const binding of element.boundElements ?? []) if (binding.type === "text") deletedIds.add(binding.id);
    }
    this.elements = this.elements.filter((item) => !deletedIds.has(item.id)).map((item) => ({ ...item, frameId: item.frameId && deletedIds.has(item.frameId) ? null : item.frameId, boundElements: item.boundElements?.filter((binding) => !deletedIds.has(binding.id)) ?? null } as WebdrawElement));
    return deletedIds;
  }

  private setZoom(value: number) { this.zoom = Math.min(30, Math.max(.1, Math.round(value * 10) / 10)); }
  private toggleTheme = () => { this.theme = this.theme === "dark" ? "light" : "dark"; this.strokeColor = this.theme === "dark" ? "#e3e3e8" : "#1b1b1f"; this.menuOpen = false; };
  private confirmReset = () => {
    if (!this.elements.length || this.ownerDocument.defaultView?.confirm("This will clear the whole canvas. Are you sure?")) { this.resetScene(); this.menuOpen = false; }
  };

  private updateSelected(patch: Record<string, unknown>) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = this.elements.map((item) => this.selectedIds.has(item.id) ? { ...item, ...patch, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  }

  private onStrokeColor = (event: InputEvent) => { this.strokeColor = (event.target as HTMLInputElement).value; this.updateSelected({ strokeColor: this.strokeColor }); this.requestUpdate(); };
  private setBackground(value: string) { this.backgroundColor = value; this.updateSelected({ backgroundColor: value }); this.requestUpdate(); }
  private setFillStyle(value: typeof this.fillStyle) { this.fillStyle = value; this.updateSelected({ fillStyle: value }); this.requestUpdate(); }
  private setStrokeWidth(value: number) { this.strokeWidth = value; this.updateSelected({ strokeWidth: value }); this.requestUpdate(); }
  private setStrokeStyle(value: typeof this.strokeStyle) { this.strokeStyle = value; this.updateSelected({ strokeStyle: value }); this.requestUpdate(); }
  private setRoughness(value: number) { this.roughness = value; this.updateSelected({ roughness: value }); this.requestUpdate(); }
  private onOpacity = (event: Event) => { this.opacity = Number((event.target as HTMLInputElement).value); this.updateSelected({ opacity: this.opacity }); this.requestUpdate(); };
  private onCanvasColor = (event: InputEvent) => { this.canvasColor = (event.target as HTMLInputElement).value; this.requestUpdate(); };

  private duplicateSelected = () => {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    const sourceIds = this.movingElementIds();
    const sources = this.elements.filter((item) => sourceIds.has(item.id));
    const ids = new Map(sources.map((item) => [item.id, this.ownerDocument.defaultView!.crypto.randomUUID()]));
    const copies = sources.map((item) => { const mutable = item as MutableElement; return { ...structuredClone(item), id: ids.get(item.id)!, x: item.x + 20, y: item.y + 20, containerId: mutable.containerId ? ids.get(mutable.containerId) ?? null : null, frameId: item.frameId ? ids.get(item.frameId) ?? item.frameId : null, boundElements: item.boundElements?.map((binding) => ({ ...binding, id: ids.get(binding.id) ?? binding.id })) ?? null, version: 1 } as WebdrawElement; });
    this.elements = [...this.elements, ...copies];
    this.selectedIds = new Set([...this.selectedIds].map((id) => ids.get(id)!));
    this.emitChange();
  };

  private copySelected = () => {
    const ids = this.movingElementIds();
    this.clipboard = structuredClone(this.elements.filter((item) => ids.has(item.id)));
  };

  private pasteClipboard = () => {
    if (!this.clipboard.length) return;
    this.checkpoint();
    const ids = new Map(this.clipboard.map((item) => [item.id, this.ownerDocument.defaultView!.crypto.randomUUID()]));
    const copies = this.clipboard.map((item) => { const mutable = item as MutableElement; return { ...structuredClone(item), id: ids.get(item.id)!, x: item.x + 20, y: item.y + 20, containerId: mutable.containerId ? ids.get(mutable.containerId) ?? null : null, frameId: item.frameId ? ids.get(item.frameId) ?? item.frameId : null, boundElements: item.boundElements?.map((binding) => ({ ...binding, id: ids.get(binding.id) ?? binding.id })) ?? null, version: 1 } as WebdrawElement; });
    this.elements = [...this.elements, ...copies];
    this.selectedIds = new Set(copies.filter((item) => !(item as MutableElement).containerId).map((item) => item.id));
    this.emitChange();
  };

  private groupSelectionFor(element: WebdrawElement) {
    const groupId = element.groupIds.at(-1);
    return groupId ? new Set(this.elements.filter((item) => item.groupIds.includes(groupId)).map((item) => item.id)) : new Set([element.id]);
  }

  private movingElementIds() {
    const ids = new Set(this.selectedIds);
    for (const selected of this.elements.filter((element) => ids.has(element.id))) {
      for (const binding of selected.boundElements ?? []) if (binding.type === "text") ids.add(binding.id);
      if (selected.type === "frame") for (const child of this.elements.filter((element) => element.frameId === selected.id)) {
        ids.add(child.id);
        for (const binding of child.boundElements ?? []) if (binding.type === "text") ids.add(binding.id);
      }
    }
    return ids;
  }

  private nudgeSelected(dx: number, dy: number, amount: number) {
    this.checkpoint();
    const ids = this.movingElementIds();
    this.elements = this.elements.map((item) => ids.has(item.id) && !item.locked ? { ...item, x: item.x + dx * amount, y: item.y + dy * amount, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  }

  private setSelectedLink = () => {
    const link = this.ownerDocument.defaultView?.prompt("Paste a link", "https://");
    if (link) this.updateSelected({ link });
  };

  private groupSelected = () => {
    if (this.selectedIds.size < 2) return;
    const groupId = this.ownerDocument.defaultView!.crypto.randomUUID();
    this.checkpoint();
    this.elements = this.elements.map((item) => this.selectedIds.has(item.id) ? { ...item, groupIds: [...item.groupIds, groupId], version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  };

  private ungroupSelected = () => {
    this.checkpoint();
    this.elements = this.elements.map((item) => this.selectedIds.has(item.id) ? { ...item, groupIds: item.groupIds.slice(0, -1), version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  };

  private sendBackward = () => this.moveSelectedLayer(-1);
  private bringForward = () => this.moveSelectedLayer(1);

  private moveSelectedLayer(direction: -1 | 1) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    const next = [...this.elements];
    if (direction < 0) {
      for (let index = 1; index < next.length; index++) if (this.selectedIds.has(next[index].id) && !this.selectedIds.has(next[index - 1].id)) [next[index - 1], next[index]] = [next[index], next[index - 1]];
    } else {
      for (let index = next.length - 2; index >= 0; index--) if (this.selectedIds.has(next[index].id) && !this.selectedIds.has(next[index + 1].id)) [next[index], next[index + 1]] = [next[index + 1], next[index]];
    }
    this.elements = next;
    this.emitChange();
  }

  private focusElement(element: WebdrawElement) {
    const rect = this.canvas!.getBoundingClientRect(), box = this.bounds(element as MutableElement);
    this.pan = { x: rect.width / 2 - (box.x + box.width / 2) * this.zoom, y: rect.height / 2 - (box.y + box.height / 2) * this.zoom };
    this.selectedIds = new Set([element.id]);
    this.dialog = null;
    this.paint();
  }

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

  private exportPng = async () => {
    const blob = await new Promise<Blob | null>((resolve) => this.createExportCanvas().toBlob(resolve, "image/png"));
    if (!blob) return;
    let output = blob;
    if (this.exportEmbedScene) {
      const chunks = extractPng(new Uint8Array(await blob.arrayBuffer()));
      chunks.splice(-1, 0, pngText.encode("application/vnd.excalidraw+json", encodeSceneMetadata(this.serializedScene())));
      output = new Blob([encodePng(chunks)], { type: "image/png" });
    }
    this.download(output, this.exportEmbedScene ? "drawing.excalidraw.png" : "drawing.png");
    this.dialog = null;
  };

  private exportSvg = () => {
    const canvas = this.createExportCanvas();
    // ponytail: raster-backed SVG keeps one renderer; replace with rough.svg when editable vector export is required.
    const metadata = this.exportEmbedScene ? `<metadata><!-- payload-type:application/vnd.excalidraw+json --><!-- payload-version:2 --><!-- payload-start -->${this.ownerDocument.defaultView!.btoa(encodeSceneMetadata(this.serializedScene()))}<!-- payload-end --></metadata>` : "";
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">${metadata}<image width="100%" height="100%" href="${canvas.toDataURL("image/png")}"/></svg>`;
    this.download(new Blob([svgData], { type: "image/svg+xml" }), "drawing.svg");
    this.dialog = null;
  };

  private copyPng = async () => {
    const blob = await new Promise<Blob | null>((resolve) => this.createExportCanvas().toBlob(resolve, "image/png"));
    const win = this.ownerDocument.defaultView as any;
    if (!blob || !win?.ClipboardItem || !win.navigator.clipboard) return;
    await win.navigator.clipboard.write([new win.ClipboardItem({ "image/png": blob })]);
    this.dialog = null;
  };

  private exportElements() {
    return this.exportSelectionOnly && this.selectedIds.size ? this.elements.filter((item) => this.selectedIds.has(item.id)) : this.elements;
  }

  private serializedScene() {
    return JSON.stringify({ type: "excalidraw", version: 2, source: "webdraw", elements: this.exportElements(), appState: this.getAppState(), files: {} });
  }

  private createExportCanvas() {
    const elements = this.exportElements();
    const boxes = elements.map((item) => this.bounds(item as MutableElement));
    const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0, minY = boxes.length ? Math.min(...boxes.map((box) => box.y)) : 0;
    const maxX = boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) : 1, maxY = boxes.length ? Math.max(...boxes.map((box) => box.y + box.height)) : 1;
    const padding = this.exportPadding, canvas = this.ownerDocument.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil((maxX - minX + padding * 2) * this.exportScale));
    canvas.height = Math.max(1, Math.ceil((maxY - minY + padding * 2) * this.exportScale));
    const context = canvas.getContext("2d")!;
    if (this.exportBackground) { context.fillStyle = this.exportDarkMode ? "#121212" : this.canvasColor; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.scale(this.exportScale, this.exportScale);
    context.translate(padding - minX, padding - minY);
    const roughCanvas = rough.canvas(canvas);
    for (const element of elements) this.paintElement(context, roughCanvas, element as MutableElement, this.exportDarkMode);
    return canvas;
  }

  private paintExportPreview() {
    const preview = this.querySelector<HTMLCanvasElement>(".export-preview canvas");
    if (!preview) return;
    const source = this.createExportCanvas(), maxWidth = 480, maxHeight = 260, scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
    preview.width = Math.max(1, source.width * scale); preview.height = Math.max(1, source.height * scale);
    preview.getContext("2d")?.drawImage(source, 0, 0, preview.width, preview.height);
  }

  private openImage = async (event: Event) => {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file) return;
    const win = this.ownerDocument.defaultView!;
    const source = await new Promise<string>((resolve, reject) => { const reader = new win.FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new win.Image();
    image.onload = () => {
      this.checkpoint();
      const rect = this.canvas!.getBoundingClientRect(), width = Math.min(400, image.naturalWidth), height = width * image.naturalHeight / image.naturalWidth;
      const point = { x: (rect.width / 2 - this.pan.x) / this.zoom, y: (rect.height / 2 - this.pan.y) / this.zoom };
      const element = newImageElement({ type: "image", x: point.x - width / 2, y: point.y - height / 2, width, height, status: "saved", fileId: win.crypto.randomUUID() as any, customData: { source } }) as WebdrawElement;
      this.imageCache.set(element.id, image); this.elements = [...this.elements, element]; this.selectedIds = new Set([element.id]); this.tool = "selection"; this.emitChange();
    };
    image.src = source; input.value = "";
  };

  private download(blob: Blob, name: string) {
    const URLClass = this.ownerDocument.defaultView!.URL;
    const url = URLClass.createObjectURL(blob);
    const anchor = this.ownerDocument.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    URLClass.revokeObjectURL(url);
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

  private paintElement(context: CanvasRenderingContext2D, roughCanvas: ReturnType<typeof rough.canvas>, element: MutableElement, darkMode = this.theme === "dark") {
    if (this.editingText?.elementId === element.id) return;
    const stroke = darkMode && element.strokeColor === "#1b1b1f" ? "#e3e3e8" : element.strokeColor;
    const options = { stroke, strokeWidth: element.strokeWidth, strokeLineDash: element.strokeStyle === "dashed" ? [8, 8] : element.strokeStyle === "dotted" ? [2, 5] : undefined, roughness: element.roughness, seed: element.seed, fill: element.backgroundColor === "transparent" ? undefined : element.backgroundColor, fillStyle: element.fillStyle };
    context.save(); context.globalAlpha = (element.opacity ?? 100) / 100;
    const box = this.bounds(element), centerX = box.x + box.width / 2, centerY = box.y + box.height / 2;
    if (element.angle) { context.translate(centerX, centerY); context.rotate(element.angle); context.translate(-centerX, -centerY); }
    if (element.customData?.webdrawSticky) {
      roughCanvas.polygon([[element.x, element.y], [element.x + element.width, element.y], [element.x + element.width, element.y + element.height - 18], [element.x + element.width - 18, element.y + element.height], [element.x, element.y + element.height]], { ...options, fill: element.backgroundColor, fillStyle: "solid" });
      roughCanvas.linearPath([[element.x + element.width - 18, element.y + element.height], [element.x + element.width - 18, element.y + element.height - 18], [element.x + element.width, element.y + element.height - 18]], options);
    } else if (element.type === "rectangle") roughCanvas.rectangle(element.x, element.y, element.width, element.height, options);
    else if (element.type === "diamond") roughCanvas.polygon([[element.x + element.width / 2, element.y], [element.x + element.width, element.y + element.height / 2], [element.x + element.width / 2, element.y + element.height], [element.x, element.y + element.height / 2]], options);
    else if (element.type === "ellipse") roughCanvas.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width, element.height, options);
    else if (element.type === "frame") {
      roughCanvas.rectangle(element.x, element.y, element.width, element.height, { ...options, fill: undefined, stroke: darkMode ? "#b8b8b8" : "#1b1b1f", roughness: 0, strokeWidth: 1 });
      context.fillStyle = darkMode ? "#b8b8b8" : "#1b1b1f"; context.font = "14px Assistant, sans-serif"; context.fillText(element.name ?? "Frame", element.x, element.y - 8);
    } else if (element.type === "embeddable") {
      roughCanvas.rectangle(element.x, element.y, element.width, element.height, { ...options, roughness: 0 });
      context.fillStyle = darkMode ? "#b8b8b8" : "#5c5c5c"; context.font = "14px Assistant, sans-serif"; context.textAlign = "center"; context.fillText(element.customData?.embedUrl || "Web Embed", element.x + element.width / 2, element.y + element.height / 2); context.textAlign = "start";
    } else if (element.type === "image") {
      const image = this.imageCache.get(element.id) ?? this.ensureImage(element);
      if (image?.complete) context.drawImage(image, element.x, element.y, element.width, element.height);
    }
    else if (element.type === "line" || element.type === "arrow") {
      const points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y] as [number, number]);
      roughCanvas.linearPath(points, options);
      if (element.type === "arrow" && points.length > 1) this.paintArrowhead(context, points.at(-2)!, points.at(-1)!, element, stroke);
    } else if (element.type === "freedraw") {
      const points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y]);
      const outline = getStroke(points, { size: element.strokeWidth * 4, thinning: .6, smoothing: .5, streamline: .5, simulatePressure: element.simulatePressure });
      if (outline.length) { context.beginPath(); context.moveTo(outline[0][0], outline[0][1]); for (const [x, y] of outline.slice(1)) context.lineTo(x, y); context.closePath(); context.fillStyle = stroke; context.fill(); }
    } else if (element.type === "text") {
      context.fillStyle = stroke; context.font = `${element.fontSize}px Excalifont, Virgil, sans-serif`; context.textBaseline = "top";
      String(element.text).split("\n").forEach((line, index) => context.fillText(line, element.x, element.y + index * element.fontSize * (element.lineHeight ?? 1.25)));
    }
    context.restore();
  }

  private ensureImage(element: MutableElement) {
    const source = element.customData?.source;
    if (!source || this.imageCache.has(element.id)) return this.imageCache.get(element.id);
    const ImageClass = this.ownerDocument.defaultView?.Image;
    if (!ImageClass) return;
    const image = new ImageClass(); image.onload = () => this.paint(); image.src = source;
    this.imageCache.set(element.id, image);
    return image;
  }

  private getEmbedUrl(element: MutableElement) {
    const value = element.customData?.embedUrl ?? element.link;
    return this.safeUrl(value);
  }

  private safeUrl(value?: string | null) {
    if (!value) return null;
    try {
      const url = new this.ownerDocument.defaultView!.URL(value, this.ownerDocument.baseURI);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch { return null; }
  }

  private paintArrowhead(context: CanvasRenderingContext2D, from: [number, number], to: [number, number], element: MutableElement, stroke = element.strokeColor) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), size = 14 + element.strokeWidth * 2;
    context.save(); context.strokeStyle = stroke; context.lineWidth = element.strokeWidth; context.lineCap = "round"; context.beginPath();
    context.moveTo(to[0] - Math.cos(angle - Math.PI / 6) * size, to[1] - Math.sin(angle - Math.PI / 6) * size); context.lineTo(to[0], to[1]);
    context.lineTo(to[0] - Math.cos(angle + Math.PI / 6) * size, to[1] - Math.sin(angle + Math.PI / 6) * size); context.stroke(); context.restore();
  }

  private paintSelection(context: CanvasRenderingContext2D) {
    context.save(); context.strokeStyle = "#6965db"; context.lineWidth = 1 / this.zoom; context.setLineDash([]);
    for (const item of this.elements.filter((element) => this.selectedIds.has(element.id))) {
      const box = this.bounds(item as MutableElement), gap = 4 / this.zoom;
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      context.save(); context.translate(center.x, center.y); context.rotate((item as MutableElement).angle ?? 0); context.translate(-center.x, -center.y);
      context.strokeRect(box.x - gap, box.y - gap, box.width + gap * 2, box.height + gap * 2);
      if (this.selectedIds.size === 1 && !(item as MutableElement).locked) {
        const handles = [[box.x - gap, box.y - gap], [center.x, box.y - gap], [box.x + box.width + gap, box.y - gap], [box.x + box.width + gap, center.y], [box.x + box.width + gap, box.y + box.height + gap], [center.x, box.y + box.height + gap], [box.x - gap, box.y + box.height + gap], [box.x - gap, center.y]];
        context.fillStyle = this.theme === "dark" ? "#1e1e1e" : "#ffffff";
        for (const [x, y] of handles) { context.fillRect(x - 4 / this.zoom, y - 4 / this.zoom, 8 / this.zoom, 8 / this.zoom); context.strokeRect(x - 4 / this.zoom, y - 4 / this.zoom, 8 / this.zoom, 8 / this.zoom); }
        const rotateY = box.y - gap - 24 / this.zoom; context.beginPath(); context.moveTo(center.x, box.y - gap); context.lineTo(center.x, rotateY); context.stroke(); context.beginPath(); context.arc(center.x, rotateY, 5 / this.zoom, 0, Math.PI * 2); context.fill(); context.stroke();
      }
      context.restore();
    }
    if (this.selectionRect) { const box = normalizeBounds(this.selectionRect.start, this.selectionRect.end); context.fillStyle = "rgba(105,101,219,.08)"; context.fillRect(box.x, box.y, box.width, box.height); context.setLineDash([4 / this.zoom, 4 / this.zoom]); context.strokeRect(box.x, box.y, box.width, box.height); }
    context.restore();
  }
}

if (!customElements.get("web-draw")) customElements.define("web-draw", WebDraw);

declare global {
  interface HTMLElementTagNameMap { "web-draw": WebDraw; }
}
