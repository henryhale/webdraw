import { LitElement, html, nothing, type PropertyValues } from "lit";
import rough from "roughjs/bin/rough";
import { getStroke } from "perfect-freehand";
import pngText from "png-chunk-text";
import encodePng from "png-chunks-encode";
import extractPng from "png-chunks-extract";
import { FONT_FAMILY, ROUNDNESS } from "@excalidraw/common";
import {
  newElement,
  newEmbeddableElement,
  newFreeDrawElement,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";
import { icon, sloppinessIcon } from "./icons";
import { SHORTCUT_GROUPS } from "./shortcuts";
import type { Arrowhead, TextAlign, Tool, VerticalAlign, WebdrawElement, WebdrawInitialData, WebdrawTheme } from "./types";
import { cursorForHandle, encodeSceneMetadata, normalizeBounds, rotatePoint, type Point, type ResizeHandle } from "./utils";
import "./styles.scss";

export type { WebdrawElement, WebdrawInitialData, WebdrawTheme } from "./types";

type MutableElement = WebdrawElement & Record<string, any>;
type TextEdit = Point & { elementId?: string; containerId?: string; fontSize: number; fontFamily: number; textAlign: TextAlign; verticalAlign: VerticalAlign; width?: number };
type Drag = {
  mode: "draw" | "move" | "pan" | "select" | "erase" | "resize" | "rotate" | "point" | "crop";
  start: Point;
  last: Point;
  draftId?: string;
  origins?: Map<string, Point>;
  pan?: Point;
  checkpointed?: boolean;
  handle?: ResizeHandle;
  element?: MutableElement;
  startAngle?: number;
  pointIndex?: number;
  multiPoint?: boolean;
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

const STROKE_COLORS = ["#1b1b1f", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const BACKGROUND_COLORS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
const NOTE_COLORS = ["#fff3bf", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffe066"];
const DARK_STROKE_COLORS = ["#e3e3e8", "#ff8787", "#40c057", "#4dabf7", "#e67700"];
const DARK_BACKGROUND_COLORS = ["transparent", "#5c2b29", "#1b5e20", "#194a66", "#5c3d00"];

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
    toolLocked: { state: true },
    propertiesOpen: { state: true },
    editingLinearId: { state: true },
    snapToObjects: { state: true },
    croppingImageId: { state: true },
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
  dialog: "export" | "help" | "search" | "commands" | null = null;
  searchQuery = "";
  editingText: TextEdit | null = null;
  selectedIds = new Set<string>();
  contextMenu: Point | null = null;
  toolLocked = false;
  propertiesOpen = true;
  editingLinearId: string | null = null;
  snapToObjects = false;
  croppingImageId: string | null = null;

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
  private fontFamily = FONT_FAMILY.Excalifont;
  private fontSize = 20;
  private textAlign: TextAlign = "left";
  private verticalAlign: VerticalAlign = "top";
  private arrowType: "sharp" | "round" | "elbow" = "round";
  private startArrowhead: Arrowhead = null;
  private endArrowhead: Arrowhead = "arrow";
  private spacePressed = false;
  private pendingLinearId: string | null = null;
  private styleClipboard: Record<string, unknown> | null = null;
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
    this.addEventListener("keydown", this.onKeyDown);
    this.addEventListener("keyup", this.onKeyUp);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.removeEventListener("keydown", this.onKeyDown);
    this.removeEventListener("keyup", this.onKeyUp);
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
    if (this.dialog === "commands") this.querySelector<HTMLInputElement>(".command-menu input")?.focus();
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
        style=${`--canvas-background: ${this.canvasColor}; --canvas-cursor: ${cursor}`}>
        <canvas class="excalidraw__canvas interactive" aria-label="Drawing canvas"
          @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp}
          @pointerleave=${this.onPointerLeave}
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
                  ${this.propertiesOpen ? this.renderProperties() : nothing}
                </div>

                ${this.viewModeEnabled ? nothing : html`
                  <section class="shapes-section" aria-label="Shapes">
                    <div class="App-toolbar-container">
                      <div class="Island App-toolbar" data-viewport-ui="top">
                        <div class="Stack Stack_horizontal toolbar-row">
                          <button class="ToolIcon ToolIcon_type_toggle ${this.toolLocked ? "ToolIcon--checked" : ""}"
                            title="Keep selected tool active (Q)" aria-label="Keep selected tool active" aria-pressed=${this.toolLocked}
                            @click=${() => this.toolLocked = !this.toolLocked}><span class="ToolIcon__icon">${icon("lock")}</span></button>
                          <span class="App-toolbar__divider"></span>
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
            style=${`left:${this.editingText.x * this.zoom + this.pan.x}px;top:${this.editingText.y * this.zoom + this.pan.y}px;font-size:${this.editingText.fontSize * this.zoom}px;font-family:${this.fontName(this.editingText.fontFamily)};text-align:${this.editingText.textAlign};${this.editingText.width ? `width:${Math.max(64, this.editingText.width * this.zoom)}px` : ""}`}
            @input=${this.onTextInput}
            @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
            @keydown=${this.onTextKeyDown} @blur=${this.commitText}></textarea>` : nothing}
        <input class="scene-input" type="file" accept="application/json,.excalidraw" @change=${this.openScene} />
        <input class="image-input" type="file" accept="image/*" @change=${this.openImage} />
        <input class="picker-proxy stroke-picker-proxy" type="color" .value=${this.strokeColor} @input=${(event: InputEvent) => this.setStrokeColor((event.target as HTMLInputElement).value)} />
        <input class="picker-proxy background-picker-proxy" type="color" .value=${this.backgroundColor === "transparent" ? "#ffffff" : this.backgroundColor} @input=${(event: InputEvent) => this.setBackground((event.target as HTMLInputElement).value)} />
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
        <button role="menuitemcheckbox" aria-checked=${this.gridModeEnabled} @click=${() => this.gridModeEnabled = !this.gridModeEnabled}>Grid mode <span>${this.gridModeEnabled ? "✓" : ""}</span></button>
        <button role="menuitemcheckbox" aria-checked=${this.snapToObjects} @click=${() => this.snapToObjects = !this.snapToObjects}>Snap to objects <span>${this.snapToObjects ? "✓" : ""}</span></button>
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
        ${item("stickynote", "Sticky note", "N")}
        ${item("laser", "Laser pointer", "K")}
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
    if (this.dialog === "commands") {
      const run = (action: () => void) => { action(); this.dialog = null; this.searchQuery = ""; };
      const commands = [
        ["Export image", () => this.dialog = "export"], ["Find on canvas", () => this.dialog = "search"],
        ["Toggle grid", () => this.gridModeEnabled = !this.gridModeEnabled], ["Toggle zen mode", () => this.zenModeEnabled = !this.zenModeEnabled],
        ["Toggle light/dark theme", this.toggleTheme], ["Zoom to fit all elements", () => this.fitElements(this.elements)],
        ["Reset zoom", () => this.setZoom(1)], ["Reset the canvas", this.confirmReset],
      ] as const;
      const query = this.searchQuery.toLowerCase();
      return html`<div class="command-menu Island" role="dialog" aria-label="Command palette">
        ${icon("search")}<input type="search" placeholder="Search commands..." .value=${this.searchQuery} @input=${(event: InputEvent) => this.searchQuery = (event.target as HTMLInputElement).value} @keydown=${(event: KeyboardEvent) => { if (event.key === "Escape") this.dialog = null; }}>
        <button class="command-close" aria-label="Close" @click=${close}>${icon("close")}</button>
        <div class="command-results">${commands.filter(([label]) => label.toLowerCase().includes(query)).map(([label, action]) => html`<button @click=${() => run(action)}>${label}</button>`)}</div>
      </div>`;
    }
    return html`
      <div class="Modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div class="Modal__background" @click=${close}></div>
        <div class="Modal__content help-dialog">
          <header><h2 id="help-title">Help</h2><button class="modal-close" @click=${close} aria-label="Close">${icon("close")}</button></header>
          <div class="help-shortcuts">${SHORTCUT_GROUPS.map((group) => html`
            <section class="shortcut-section">
              <h3>${group.title}</h3>
              <div class="shortcut-grid">${group.items.map((item) => html`
                <span class="shortcut-label">${item.label}</span>
                <span class="shortcut-bindings">${item.bindings.map((binding, index) => html`${index ? html`<small>or</small>` : nothing}<span class="shortcut-binding">${binding.map((key) => html`<kbd>${key}</kbd>`)}</span>`)}</span>
              `)}</div>
            </section>`)}
          </div>
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
    const selected = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement | undefined;
    const sticky = !!selected?.customData?.webdrawSticky || this.tool === "stickynote";
    const textOnly = selected?.type === "text" || this.tool === "text";
    const text = textOnly || sticky || !!(selected && this.boundLabel(selected));
    const linear = selected?.type === "arrow" || this.tool === "arrow";
    const locked = this.elements.some((item) => this.selectedIds.has(item.id) && item.locked);
    const palette = (colors: string[], current: string, set: (color: string) => void, allowTransparent = false) => html`
      <span class="color-palette">
        ${allowTransparent ? html`<button class="color-swatch transparent ${current === "transparent" ? "selected" : ""}" title="Transparent" aria-label="Transparent" @click=${() => set("transparent")}>×</button>` : nothing}
        ${colors.filter((color) => color !== "transparent").map((color) => html`<button class="color-swatch ${current === color ? "selected" : ""}" style=${`--swatch:${color}`} title=${color} aria-label=${color} @click=${() => set(color)}></button>`)}
        <input class="color-swatch custom-color" type="color" .value=${current === "transparent" ? "#ffffff" : current} aria-label="Custom color" @input=${(event: InputEvent) => set((event.target as HTMLInputElement).value)}>
      </span>`;
    return html`
      <div class="Island selected-shape-actions">
        <label>${sticky ? "Text color" : "Stroke"}${palette(this.theme === "dark" ? DARK_STROKE_COLORS : STROKE_COLORS, this.strokeColor, this.setStrokeColor)}</label>
        ${textOnly ? nothing : html`<label>Background${palette(sticky ? (this.theme === "dark" ? DARK_BACKGROUND_COLORS.slice(1) : NOTE_COLORS) : (this.theme === "dark" ? DARK_BACKGROUND_COLORS : BACKGROUND_COLORS), this.backgroundColor, this.setBackground, !sticky)}</label>`}
        ${textOnly || sticky || linear ? nothing : html`
          <label>Fill <span class="segmented wide">${(["hachure", "cross-hatch", "solid"] as const).map((style) => html`<button title=${style} class=${this.fillStyle === style ? "selected" : ""} @click=${() => this.setFillStyle(style)}>${style === "hachure" ? "╱" : style === "cross-hatch" ? "╳" : "■"}</button>`)}</span></label>`}
        ${textOnly || sticky ? nothing : html`
          <label>Stroke width <span class="segmented">${[1, 2, 4].map((width) => html`<button class=${this.strokeWidth === width ? "selected" : ""} @click=${() => this.setStrokeWidth(width)} aria-label=${`Stroke width ${width}`}><span class=${`stroke-width-${width}`}></span></button>`)}</span></label>
          <label>Stroke style <span class="segmented wide">${(["solid", "dashed", "dotted"] as const).map((style) => html`<button title=${style} class=${this.strokeStyle === style ? "selected" : ""} @click=${() => this.setStrokeStyle(style)}>${style === "solid" ? "━" : style === "dashed" ? "┅" : "┈"}</button>`)}</span></label>`}
        ${textOnly ? nothing : html`<label>Sloppiness <span class="segmented">${[0, 1, 2].map((value) => html`<button title=${["Architect", "Artist", "Cartoonist"][value]} aria-label=${`Sloppiness ${value + 1}`} class=${this.roughness === value ? "selected" : ""} @click=${() => this.setRoughness(value)}>${sloppinessIcon(value)}</button>`)}</span></label>`}
        ${sticky ? html`<label>Edges <span class="segmented">${[false, true].map((round) => html`<button class=${(selected?.customData?.webdrawRound !== false) === round ? "selected" : ""} title=${round ? "Round" : "Sharp"} @click=${() => this.setStickyRound(round)}>${round ? "╭" : "⌜"}</button>`)}</span></label>` : nothing}
        ${linear ? html`
          <label>Arrow type <span class="segmented">${(["sharp", "round", "elbow"] as const).map((type) => html`<button class=${this.arrowType === type ? "selected" : ""} title=${type} @click=${() => this.setArrowType(type)}>${type === "sharp" ? "↗" : type === "round" ? "↷" : "↱"}</button>`)}</span></label>
          <label>Arrowheads <span class="arrowheads-row"><span class="segmented">${([null, "arrow", "bar"] as Arrowhead[]).map((head) => html`<button class=${this.startArrowhead === head ? "selected" : ""} title=${`Start ${head ?? "none"}`} @click=${() => this.setArrowhead("start", head)}>${head === null ? "×–" : head === "bar" ? "|–" : "←"}</button>`)}</span><span class="segmented">${([null, "arrow", "triangle", "circle", "diamond", "bar"] as Arrowhead[]).map((head) => html`<button class=${this.endArrowhead === head ? "selected" : ""} title=${`End ${head ?? "none"}`} @click=${() => this.setArrowhead("end", head)}>${head === null ? "–×" : head === "triangle" ? "▷" : head === "circle" ? "–○" : head === "diamond" ? "–◇" : head === "bar" ? "–|" : "→"}</button>`)}</span></span></label>` : nothing}
        ${text ? html`
          <label>Font family <span class="segmented font-family">${([[FONT_FAMILY.Excalifont, "✎", "Hand-drawn"], [FONT_FAMILY.Nunito, "A", "Normal"], [FONT_FAMILY["Comic Shanns"], "‹/›", "Code"], [FONT_FAMILY.Cascadia, "A", "Cascadia"]] as const).map(([family, mark, title]) => html`<button class=${this.fontFamily === family ? "selected" : ""} title=${title} @click=${() => this.setFontFamily(family)}>${mark}</button>`)}</span></label>
          <label>Font size <span class="segmented font-size">${([[16, "S"], [20, "M"], [28, "L"], [36, "XL"]] as const).map(([size, label]) => html`<button class=${this.fontSize === size ? "selected" : ""} @click=${() => this.setFontSize(size)}>${label}</button>`)}</span></label>
          <label>Text align <span class="segmented">${(["left", "center", "right"] as const).map((align) => html`<button class="text-${align} ${this.textAlign === align ? "selected" : ""}" title=${align} @click=${() => this.setTextAlign(align)}>≡</button>`)}</span></label>
          ${sticky ? html`<label>Vertical align <span class="segmented">${(["top", "middle", "bottom"] as const).map((align) => html`<button class=${this.verticalAlign === align ? "selected" : ""} title=${align} @click=${() => this.setVerticalAlign(align)}>${align === "top" ? "⊤" : align === "middle" ? "⊢" : "⊥"}</button>`)}</span></label>` : nothing}` : nothing}
        <label>Opacity <span class="range-row"><input type="range" min="0" max="100" .value=${String(this.opacity)} @input=${this.onOpacity}><output>${this.opacity}</output></span></label>
        ${this.selectedIds.size ? html`
          <label>Layers <span class="action-row icon-actions"><button title="Send to back" @click=${this.sendToBack}>${icon("sendBack")}</button><button title="Send backward" @click=${this.sendBackward}>${icon("sendBackward")}</button><button title="Bring forward" @click=${this.bringForward}>${icon("bringForward")}</button><button title="Bring to front" @click=${this.bringToFront}>${icon("bringFront")}</button></span></label>
          <label>Actions <span class="action-row icon-actions"><button title="Duplicate" @click=${this.duplicateSelected}>${icon("duplicate")}</button><button class="danger" title="Delete" @click=${this.deleteSelected}>${icon("delete")}</button><button title="Add link" @click=${this.setSelectedLink}>${icon("link")}</button><button title=${locked ? "Unlock" : "Lock"} @click=${() => this.updateSelected({ locked: !locked })}>${icon("lock")}</button></span></label>` : nothing}
      </div>`;
  }

  private setTool(tool: Tool) {
    if (this.viewModeEnabled) return;
    if (this.pendingLinearId) this.finishPendingLinear();
    this.tool = tool;
    if (tool === "stickynote") this.backgroundColor = this.theme === "dark" ? "#5c3d00" : "#fff3bf";
    if (tool !== "selection") this.selectedIds = new Set();
    if (this.canvas) this.canvas.style.cursor = "";
    this.focus();
  }

  private finishPendingLinear = () => {
    if (!this.pendingLinearId) return;
    const id = this.pendingLinearId, element = this.elements.find((item) => item.id === id) as MutableElement | undefined;
    this.pendingLinearId = null;
    if (!element) return;
    const points = element.points.slice(0, -1).filter((point: number[], index: number, all: number[][]) => !index || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1]);
    if (points.length < 2) this.elements = this.elements.filter((item) => item.id !== id);
    else {
      const xs = points.map(([x]: number[]) => x), ys = points.map(([, y]: number[]) => y);
      this.replaceElement({ ...element, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), version: element.version + 1 } as WebdrawElement);
      this.selectedIds = new Set([id]);
    }
    if (!this.toolLocked) this.tool = "selection";
    this.emitChange(); this.requestUpdate();
  };

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
    if (this.tool === "hand" || event.button === 1 || this.spacePressed) {
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
    if ((this.tool === "line" || this.tool === "arrow") && this.pendingLinearId) {
      const element = this.elements.find((item) => item.id === this.pendingLinearId) as MutableElement | undefined;
      if (element) {
        const nextPoint = [point.x - element.x, point.y - element.y], points = [...element.points.slice(0, -1), nextPoint, nextPoint];
        this.replaceElement({ ...element, points, version: element.version + 1 } as WebdrawElement);
        this.drag = { mode: "draw", start: point, last: point, draftId: element.id, checkpointed: true, multiPoint: true };
        return;
      }
      this.pendingLinearId = null;
    }
    if (this.tool === "bucket") {
      const hit = this.hitTest(point);
      if (hit && !["text", "line", "arrow", "freedraw", "frame"].includes(hit.type)) {
        this.selectedIds = new Set([hit.id]);
        this.setBackground(this.backgroundColor === "transparent" ? (this.theme === "dark" ? "#194a66" : "#a5d8ff") : this.backgroundColor);
      }
      return;
    }
    if (this.tool === "selection") {
      const editedLinear = this.editingLinearId ? this.elements.find((item) => item.id === this.editingLinearId) as MutableElement | undefined : undefined;
      if (editedLinear?.points) {
        const pointIndex = editedLinear.points.findIndex(([x, y]: number[]) => Math.hypot(point.x - editedLinear.x - x, point.y - editedLinear.y - y) <= 10 / this.zoom);
        if (pointIndex >= 0) { this.checkpoint(); this.drag = { mode: "point", start: point, last: point, element: structuredClone(editedLinear), pointIndex }; return; }
      }
      const transform = this.selectionHandleAt(point);
      if (transform) {
        const element = structuredClone(this.elements.find((item) => this.selectedIds.has(item.id))!) as MutableElement;
        this.checkpoint();
        const box = this.bounds(element), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        this.drag = transform === "rotate"
          ? { mode: "rotate", start: point, last: point, element, startAngle: Math.atan2(point.y - center.y, point.x - center.x) }
          : { mode: element.id === this.croppingImageId ? "crop" : "resize", start: point, last: point, element, handle: transform };
        this.canvas!.style.cursor = transform === "rotate" ? "grabbing" : cursorForHandle(transform, element.angle);
        return;
      }
      const hits = this.hitTestAll(point);
      const targets = hits.map((item) => item.type === "text" && (item as MutableElement).containerId ? this.elements.find((candidate) => candidate.id === (item as MutableElement).containerId) ?? item : item).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
      const hit = (event.ctrlKey || event.metaKey) ? targets.find((item) => !this.selectedIds.has(item.id)) ?? targets[0] : targets[0];
      if (hit) {
        if ((event.ctrlKey || event.metaKey) && hit.link) { const url = this.safeUrl(hit.link); if (url) this.ownerDocument.defaultView?.open(url, "_blank", "noopener"); return; }
        if (!event.shiftKey && !this.selectedIds.has(hit.id)) this.selectedIds = this.groupSelectionFor(hit);
        else if (event.shiftKey) {
          const next = new Set(this.selectedIds);
          next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id);
          this.selectedIds = next;
        }
        if ((event.ctrlKey || event.metaKey) && !hit.link) { this.syncStyleFromElement(hit as MutableElement); return; }
        if (event.altKey && !event.shiftKey) this.duplicateSelected();
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
      element = newLinearElement({ ...base, type: tool, points: [[0, 0], [0, 0]] as any, roundness: this.arrowType === "round" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null }) as WebdrawElement;
      if (tool === "arrow") element = { ...element, startArrowhead: this.startArrowhead, endArrowhead: this.endArrowhead, elbowed: this.arrowType === "elbow" } as WebdrawElement;
    } else if (tool === "freedraw" || tool === "laser") {
      element = newFreeDrawElement({ ...base, type: "freedraw", strokeColor: tool === "laser" ? "#e03131" : base.strokeColor, points: [[0, 0]] as any, simulatePressure: true, customData: tool === "laser" ? { webdrawLaser: true } : undefined }) as WebdrawElement;
    } else if (tool === "frame") {
      element = newFrameElement({ ...base, name: null as any }) as WebdrawElement;
    } else if (tool === "embeddable") {
      element = newEmbeddableElement({ ...base, type: "embeddable" }) as WebdrawElement;
    } else if (tool === "stickynote") {
      element = newElement({ ...base, type: "rectangle", strokeColor: this.strokeColor, backgroundColor: this.backgroundColor === "transparent" ? (this.theme === "dark" ? "#5c3d00" : "#fff3bf") : this.backgroundColor, fillStyle: "solid", customData: { webdrawSticky: true, webdrawRound: true, stickyCreated: Date.now() } }) as WebdrawElement;
    } else {
      element = newElement({ ...base, type: tool as "rectangle" | "diamond" | "ellipse" }) as WebdrawElement;
    }
    this.elements = [...this.elements, element];
    this.drag = { mode: "draw", start: point, last: point, draftId: element.id, checkpointed: true };
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag) {
      if (this.pendingLinearId) {
        const element = this.elements.find((item) => item.id === this.pendingLinearId) as MutableElement | undefined;
        if (element) {
          const point = this.scenePoint(event), points = [...element.points]; points[points.length - 1] = [point.x - element.x, point.y - element.y];
          this.replaceElement({ ...element, points, version: element.version + 1 } as WebdrawElement); this.paint(); return;
        }
      }
      const handle = this.tool === "selection" ? this.selectionHandleAt(this.scenePoint(event)) : null;
      const selected = handle && handle !== "rotate" ? this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement | undefined : undefined;
      this.canvas!.style.cursor = handle === "rotate" ? "grab" : handle ? cursorForHandle(handle, selected?.angle) : "";
      return;
    }
    if (this.drag.mode === "pan") {
      this.pan = { x: this.drag.pan!.x + event.clientX - this.drag.last.x, y: this.drag.pan!.y + event.clientY - this.drag.last.y };
      this.requestUpdate();
      return;
    }
    const point = this.scenePoint(event);
    this.drag.last = point;
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
    if (this.drag.mode === "crop") {
      this.replaceElement(this.cropImage(this.drag.element!, this.drag.handle!, point));
      return;
    }
    if (this.drag.mode === "point") {
      const original = this.drag.element!, points = original.points.map((item: number[]) => [...item]);
      points[this.drag.pointIndex!] = [point.x - original.x, point.y - original.y];
      const xs = points.map(([x]: number[]) => x), ys = points.map(([, y]: number[]) => y);
      this.replaceElement({ ...original, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), version: original.version + 1 } as WebdrawElement);
      return;
    }
    if (this.drag.mode === "move") {
      if (!this.drag.checkpointed) { this.checkpoint(); this.drag.checkpointed = true; }
      let dx = point.x - this.drag.start.x, dy = point.y - this.drag.start.y;
      if (this.snapToObjects) ({ x: dx, y: dy } = this.snappedDelta(this.movingElementIds(), dx, dy));
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
      const points = this.drag.multiPoint ? [...draft.points.slice(0, -1), [point.x - draft.x, point.y - draft.y]] : [[0, 0], [point.x - this.drag.start.x, point.y - this.drag.start.y]];
      const xs = points.map(([x]: number[]) => x), ys = points.map(([, y]: number[]) => y);
      next = { ...draft, points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), version: draft.version + 1 } as unknown as MutableElement;
    } else {
      next = { ...draft, ...normalizeBounds(this.drag.start, point), version: draft.version + 1 };
    }
    this.elements = [...this.elements.slice(0, index), next as WebdrawElement, ...this.elements.slice(index + 1)];
  };

  private onPointerUp = () => {
    if (!this.drag) return;
    let changed = this.drag.mode === "draw" || this.drag.mode === "move" || this.drag.mode === "erase" || this.drag.mode === "resize" || this.drag.mode === "rotate" || this.drag.mode === "point" || this.drag.mode === "crop";
    if (this.drag.mode === "draw") {
      let element = this.elements.find((item) => item.id === this.drag!.draftId);
      const laser = !!(element as MutableElement | undefined)?.customData?.webdrawLaser;
      const linearClick = !!element && (element.type === "line" || element.type === "arrow") && this.isTiny(element);
      if (this.drag.multiPoint) {
        this.pendingLinearId = element?.id ?? null;
        this.selectedIds = new Set();
      } else if (linearClick) {
        this.pendingLinearId = element!.id;
        this.selectedIds = new Set();
      } else if (element && (element as MutableElement).customData?.webdrawSticky && this.isTiny(element)) {
        element = { ...element, width: 250, height: 250, version: element.version + 1 } as WebdrawElement;
        this.replaceElement(element);
      } else if (element && this.isTiny(element)) { const id = element.id; this.elements = this.elements.filter((item) => item.id !== id); }
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
      if ((element as MutableElement | undefined)?.customData?.webdrawSticky && this.elements.some((item) => item.id === element!.id)) {
        this.startTextEditing({ x: element!.x, y: element!.y }, undefined, element!.id);
      }
      if (!this.pendingLinearId && !this.toolLocked && this.tool !== "freedraw" && this.tool !== "laser") this.tool = "selection";
    }
    this.drag = null;
    this.selectionRect = null;
    if (this.canvas) this.canvas.style.cursor = "";
    if (changed) this.emitChange();
    this.requestUpdate();
  };

  private onPointerLeave = () => { if (!this.drag && this.canvas) this.canvas.style.cursor = ""; };

  private onDoubleClick = (event: MouseEvent) => {
    if (this.viewModeEnabled) return;
    event.preventDefault();
    if (this.pendingLinearId) { this.finishPendingLinear(); return; }
    const point = this.scenePoint(event as unknown as PointerEvent);
    const hit = this.hitTest(point);
    if (hit?.type === "text") this.startTextEditing(point, hit as MutableElement);
    else if (hit?.type === "image") { this.selectedIds = new Set([hit.id]); this.croppingImageId = hit.id; }
    else if (hit?.type === "line" || hit?.type === "arrow") { this.selectedIds = new Set([hit.id]); this.editingLinearId = hit.id; }
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
    const target = event.composedPath()[0] as HTMLElement | undefined;
    if (target?.matches?.("input, textarea, select, button, a")) return;
    const key = event.key.toLowerCase();
    const primary = event.ctrlKey || event.metaKey;
    const run = (action: () => void) => { event.preventDefault(); action(); };
    if (event.code === "Space") { event.preventDefault(); this.spacePressed = true; return; }
    if (this.pendingLinearId && event.key === "Enter") { run(this.finishPendingLinear); return; }
    if (this.pendingLinearId && event.key === "Escape") { run(this.finishPendingLinear); return; }
    if (this.croppingImageId && (event.key === "Enter" || event.key === "Escape")) { run(() => this.croppingImageId = null); return; }
    if (primary && event.key === "Enter" && this.selectedIds.size === 1) {
      const selected = this.elements.find((item) => this.selectedIds.has(item.id));
      if (selected?.type === "line" || selected?.type === "arrow") { run(() => this.editingLinearId = selected.id); return; }
    }
    if (primary && event.key === "Delete") { run(this.confirmReset); return; }
    if (primary && event.altKey && key === "c") { run(this.copyStyles); return; }
    if (primary && event.altKey && key === "v") { run(this.pasteStyles); return; }
    if (primary && event.shiftKey && event.code === "BracketLeft") { run(this.sendToBack); return; }
    if (primary && event.shiftKey && event.code === "BracketRight") { run(this.bringToFront); return; }
    if (primary && event.code === "BracketLeft") { run(this.sendBackward); return; }
    if (primary && event.code === "BracketRight") { run(this.bringForward); return; }
    if (primary && event.shiftKey && event.key.startsWith("Arrow") && this.selectedIds.size) { run(() => this.alignSelected(event.key)); return; }
    if (primary && event.key.startsWith("Arrow") && this.selectedIds.size === 1) { run(() => this.createFlowchartNode(event.key)); return; }
    if (primary && event.shiftKey && key === "l") { run(this.toggleSelectedLock); return; }
    if (primary && event.shiftKey && (event.key === "<" || event.key === ">")) { run(() => this.changeFontSize(event.key === ">" ? 4 : -4)); return; }
    if (primary && (event.key === "+" || event.key === "=")) { run(() => this.setZoom(this.zoom + .1)); return; }
    if (primary && event.key === "-") { run(() => this.setZoom(this.zoom - .1)); return; }
    if (primary && key === "0") { run(() => this.setZoom(1)); return; }
    if (primary && event.key === "'") { run(() => this.gridModeEnabled = !this.gridModeEnabled); return; }
    if (primary && key === "k") { run(this.setSelectedLink); return; }
    if (primary && key === "f") { run(() => this.dialog = "search"); return; }
    if (primary && key === "/") { run(() => { this.searchQuery = ""; this.dialog = "commands"; }); return; }
    if (primary && event.shiftKey && key === "e") { run(() => this.dialog = "export"); return; }
    if (primary && key === "o") { run(() => this.querySelector<HTMLInputElement>(".scene-input")?.click()); return; }
    if (primary && key === "a") { run(() => this.selectedIds = new Set(this.elements.filter((item) => !(item as MutableElement).containerId).map((item) => item.id))); return; }
    if (primary && key === "c" && this.selectedIds.size) { run(this.copySelected); return; }
    if (primary && key === "x" && this.selectedIds.size) { run(() => { this.copySelected(); this.deleteSelected(); }); return; }
    if (primary && event.shiftKey && key === "v") { run(this.pastePlaintext); return; }
    if (primary && key === "v" && this.clipboard.length) { run(this.pasteClipboard); return; }
    if (primary && key === "d" && this.selectedIds.size) { run(this.duplicateSelected); return; }
    if (primary && key === "g" && this.selectedIds.size) { run(event.shiftKey ? this.ungroupSelected : this.groupSelected); return; }
    if (primary && key === "z") { run(event.shiftKey ? this.redo : this.undo); return; }
    if (primary && key === "y") { run(this.redo); return; }
    if (event.altKey && event.shiftKey && key === "d") { run(this.toggleTheme); return; }
    if (event.altKey && key === "z") { run(() => this.zenModeEnabled = !this.zenModeEnabled); return; }
    if (event.altKey && key === "r") { run(() => this.viewModeEnabled = !this.viewModeEnabled); return; }
    if (event.altKey && event.key.startsWith("Arrow")) { run(() => this.navigateFlowchart(event.key)); return; }
    if (event.altKey && key === "/") { run(() => this.propertiesOpen = !this.propertiesOpen); return; }
    if (event.altKey && key === "s") { run(() => this.snapToObjects = !this.snapToObjects); return; }
    if (event.shiftKey && event.altKey && key === "c") { run(this.copyPng); return; }
    if (event.shiftKey && key === "1") { run(() => this.fitElements(this.elements)); return; }
    if (event.shiftKey && key === "2") { run(() => this.fitElements(this.elements.filter((item) => this.selectedIds.has(item.id)))); return; }
    if (event.shiftKey && key === "h" && this.selectedIds.size) { run(() => this.flipSelected("horizontal")); return; }
    if (event.shiftKey && key === "v" && this.selectedIds.size) { run(() => this.flipSelected("vertical")); return; }
    if (key === "i" || (event.shiftKey && (key === "s" || key === "g"))) { run(this.pickColor); return; }
    if (event.shiftKey && key === "f") { run(() => { this.propertiesOpen = true; void this.updateComplete.then(() => this.querySelector<HTMLElement>(".font-family button")?.focus()); }); return; }
    if ((key === "s" || key === "g") && !event.altKey) { run(() => this.querySelector<HTMLInputElement>(key === "s" ? ".stroke-picker-proxy" : ".background-picker-proxy")?.click()); return; }
    if (event.key === "PageUp" || event.key === "PageDown") { event.preventDefault(); const delta = event.key === "PageUp" ? 100 : -100; event.shiftKey ? this.pan.x += delta : this.pan.y += delta; this.requestUpdate(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && this.selectedIds.size) { event.preventDefault(); this.deleteSelected(); return; }
    if (!event.altKey && event.key.startsWith("Arrow") && this.selectedIds.size) { event.preventDefault(); this.nudgeSelected(event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0, event.shiftKey ? 10 : 1); return; }
    if (event.key === "?") { this.dialog = "help"; return; }
    if (event.key === "Escape") { this.editingLinearId = null; this.selectedIds = new Set(); this.tool = "selection"; this.menuOpen = false; this.moreToolsOpen = false; this.libraryOpen = false; this.dialog = null; return; }
    if (event.key === "Enter" && this.selectedIds.size === 1) {
      const selected = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement;
      if (selected.type === "image") this.croppingImageId = selected.id;
      else if (selected.type === "text") this.startTextEditing({ x: selected.x, y: selected.y }, selected);
      else {
        const labelId = selected.boundElements?.find((binding) => binding.type === "text")?.id;
        const label = labelId ? this.elements.find((item) => item.id === labelId) as MutableElement | undefined : undefined;
        label ? this.startTextEditing({ x: label.x, y: label.y }, label) : this.startTextEditing({ x: selected.x, y: selected.y }, undefined, selected.id);
      }
      return;
    }
    if (event.key === "Tab" && this.selectedIds.size) { run(() => this.cycleSelectedShape(event.shiftKey ? -1 : 1)); return; }
    if (key === "9") { this.querySelector<HTMLInputElement>(".image-input")?.click(); return; }
    if (key === "q") { this.toolLocked = !this.toolLocked; return; }
    const shortcuts: Record<string, Tool> = { h: "hand", v: "selection", "1": "selection", r: "rectangle", "2": "rectangle", d: "diamond", "3": "diamond", o: "ellipse", "4": "ellipse", a: "arrow", "5": "arrow", l: "line", "6": "line", p: "freedraw", "7": "freedraw", t: "text", "8": "text", e: "eraser", "0": "eraser", f: "frame", k: "laser", n: "stickynote", b: "bucket" };
    if (!primary && !event.altKey && !event.shiftKey && shortcuts[key]) { event.preventDefault(); this.setTool(shortcuts[key]); }
  };

  private onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") this.spacePressed = false; };

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
      const fresh = newTextElement({ x: edit.x, y: edit.y, text, strokeColor: existing?.strokeColor ?? this.strokeColor, fontSize: edit.fontSize, fontFamily: edit.fontFamily as any, containerId: edit.containerId ?? null, textAlign: edit.textAlign, verticalAlign: edit.verticalAlign }) as MutableElement;
      let element = existing ? { ...existing, text, originalText: text, width: fresh.width, height: fresh.height, fontSize: edit.fontSize, fontFamily: edit.fontFamily, textAlign: edit.textAlign, verticalAlign: edit.verticalAlign, version: existing.version + 1 } as WebdrawElement : fresh as WebdrawElement;
      if (edit.containerId) {
        const container = this.elements.find((item) => item.id === edit.containerId)!;
        element = { ...element, ...this.labelPosition(container as MutableElement, fresh, edit.verticalAlign), containerId: container.id } as WebdrawElement;
        if (!existing) this.elements = this.elements.map((item) => item.id === container.id ? { ...item, boundElements: [...(item.boundElements ?? []), { id: element.id, type: "text" }] } as WebdrawElement : item);
      }
      this.elements = existing ? this.elements.map((item) => item.id === existing.id ? element : item) : [...this.elements, element];
      this.selectedIds = new Set([edit.containerId ?? element.id]);
      this.emitChange();
    } else if (edit.elementId) {
      this.selectedIds = new Set([edit.elementId]);
      this.deleteSelected();
    }
    this.textDraft = "";
    this.editingText = null;
    if (!this.toolLocked) this.tool = "selection";
  };

  private startTextEditing(point: Point, element?: MutableElement, containerId?: string) {
    if (element) {
      this.editingText = { x: element.x, y: element.y, fontSize: element.fontSize ?? this.fontSize, fontFamily: element.fontFamily ?? this.fontFamily, textAlign: element.textAlign ?? this.textAlign, verticalAlign: element.verticalAlign ?? this.verticalAlign, width: element.width, elementId: element.id, containerId: element.containerId ?? undefined };
      this.textDraft = element.text ?? "";
      this.selectedIds = new Set([element.id]);
    } else if (containerId) {
      const container = this.elements.find((item) => item.id === containerId)!;
      this.editingText = { x: container.x + 8, y: container.y + container.height / 2 - this.fontSize / 2, width: Math.max(64, container.width - 16), fontSize: this.fontSize, fontFamily: this.fontFamily, textAlign: "center", verticalAlign: "middle", containerId };
      this.textDraft = "";
      this.selectedIds = new Set([containerId]);
    } else {
      this.editingText = { ...point, fontSize: this.fontSize, fontFamily: this.fontFamily, textAlign: this.textAlign, verticalAlign: this.verticalAlign };
      this.textDraft = "";
    }
  }

  private replaceElement(element: WebdrawElement) {
    const mutable = element as MutableElement;
    const labelIds = new Set(element.boundElements?.filter((binding) => binding.type === "text").map((binding) => binding.id));
    this.elements = this.elements.map((item) => {
      if (item.id === element.id) return element;
      if (!labelIds.has(item.id)) return item;
      return { ...item, ...this.labelPosition(mutable, item as MutableElement, (item as MutableElement).verticalAlign), angle: mutable.angle ?? 0, version: item.version + 1 } as WebdrawElement;
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
    const label = element.type === "text" ? element : this.boundLabel(element);
    if (label) {
      this.fontFamily = label.fontFamily ?? this.fontFamily;
      this.fontSize = label.fontSize ?? this.fontSize;
      this.textAlign = label.textAlign ?? this.textAlign;
      this.verticalAlign = label.verticalAlign ?? this.verticalAlign;
      if (element.customData?.webdrawSticky) this.strokeColor = label.strokeColor ?? element.strokeColor;
    }
    if (element.type === "arrow") {
      this.arrowType = element.elbowed ? "elbow" : element.roundness ? "round" : "sharp";
      this.startArrowhead = element.startArrowhead ?? null;
      this.endArrowhead = element.endArrowhead ?? null;
    }
  }

  private boundLabel(element: MutableElement) {
    const id = element.boundElements?.find((binding: { type: string }) => binding.type === "text")?.id;
    return id ? this.elements.find((item) => item.id === id) as MutableElement | undefined : undefined;
  }

  private labelPosition(container: MutableElement, label: MutableElement, verticalAlign: VerticalAlign = "middle") {
    const footer = container.customData?.webdrawSticky ? 36 : 0;
    const y = verticalAlign === "top" ? container.y + 16 : verticalAlign === "bottom" ? container.y + container.height - label.height - 16 - footer : container.y + (container.height - footer - label.height) / 2;
    return { x: container.x + (container.width - label.width) / 2, y };
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

  private cropImage(original: MutableElement, handle: ResizeHandle, point: Point): WebdrawElement {
    const resized = this.resizeElement(original, handle, point, false) as MutableElement;
    const crop = original.customData?.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const left = handle.includes("w") ? (resized.x - original.x) / original.width : 0;
    const top = handle.includes("n") ? (resized.y - original.y) / original.height : 0;
    const width = resized.width / original.width, height = resized.height / original.height;
    const x = Math.max(0, Math.min(crop.x + crop.width * left, crop.x + crop.width - .01));
    const y = Math.max(0, Math.min(crop.y + crop.height * top, crop.y + crop.height - .01));
    const nextCrop = { x, y, width: Math.max(.01, Math.min(1 - x, crop.width * width)), height: Math.max(.01, Math.min(1 - y, crop.height * height)) };
    return { ...resized, customData: { ...(original.customData ?? {}), crop: nextCrop } } as WebdrawElement;
  }

  private bounds(element: MutableElement) {
    if (element.points) {
      const xs = element.points.map(([x]: number[]) => element.x + x), ys = element.points.map(([, y]: number[]) => element.y + y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return normalizeBounds({ x: element.x, y: element.y }, { x: element.x + element.width, y: element.y + element.height });
  }

  private hitTest(point: Point) {
    return this.hitTestAll(point)[0];
  }

  private hitTestAll(point: Point) {
    const threshold = 8 / this.zoom;
    return [...this.elements].reverse().filter((item) => {
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

  private setStrokeColor = (value: string) => {
    this.strokeColor = value;
    if (this.selectedIds.size) {
      const ids = new Set(this.selectedIds);
      for (const item of this.elements.filter((element) => ids.has(element.id) && (element as MutableElement).customData?.webdrawSticky)) {
        for (const binding of item.boundElements ?? []) if (binding.type === "text") ids.add(binding.id);
      }
      this.checkpoint();
      this.elements = this.elements.map((item) => ids.has(item.id) ? { ...item, strokeColor: value, version: item.version + 1 } as WebdrawElement : item);
      this.emitChange();
    }
    this.requestUpdate();
  };
  private setBackground(value: string) { this.backgroundColor = value; this.updateSelected({ backgroundColor: value }); this.requestUpdate(); }
  private setFillStyle(value: typeof this.fillStyle) { this.fillStyle = value; this.updateSelected({ fillStyle: value }); this.requestUpdate(); }
  private setStrokeWidth(value: number) { this.strokeWidth = value; this.updateSelected({ strokeWidth: value }); this.requestUpdate(); }
  private setStrokeStyle(value: typeof this.strokeStyle) { this.strokeStyle = value; this.updateSelected({ strokeStyle: value }); this.requestUpdate(); }
  private setRoughness(value: number) { this.roughness = value; this.updateSelected({ roughness: value }); this.requestUpdate(); }
  private setStickyRound(round: boolean) {
    const selected = this.elements.find((item) => this.selectedIds.has(item.id));
    if (!selected) return;
    this.checkpoint();
    this.elements = this.elements.map((item) => item.id === selected.id ? { ...item, customData: { ...(item.customData ?? {}), webdrawRound: round }, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  }
  private onOpacity = (event: Event) => {
    this.opacity = Number((event.target as HTMLInputElement).value);
    if (!this.selectedIds.size) { this.requestUpdate(); return; }
    const ids = new Set(this.selectedIds);
    for (const item of this.elements.filter((element) => ids.has(element.id))) for (const binding of item.boundElements ?? []) if (binding.type === "text") ids.add(binding.id);
    this.checkpoint();
    this.elements = this.elements.map((item) => ids.has(item.id) ? { ...item, opacity: this.opacity, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange(); this.requestUpdate();
  };
  private onCanvasColor = (event: InputEvent) => { this.canvasColor = (event.target as HTMLInputElement).value; this.requestUpdate(); };

  private updateTextStyle(patch: Record<string, unknown>) {
    const ids = new Set<string>();
    for (const item of this.elements) {
      if (this.selectedIds.has(item.id) && item.type === "text") ids.add(item.id);
      if (this.selectedIds.has(item.id)) for (const binding of item.boundElements ?? []) if (binding.type === "text") ids.add(binding.id);
    }
    if (!ids.size) { this.requestUpdate(); return; }
    this.checkpoint();
    this.elements = this.elements.map((item) => {
      if (!ids.has(item.id)) return item;
      const source = { ...(item as MutableElement), ...patch };
      const fresh = newTextElement({ x: source.x, y: source.y, text: source.text, strokeColor: source.strokeColor, fontSize: source.fontSize, fontFamily: source.fontFamily, textAlign: source.textAlign, verticalAlign: source.verticalAlign, containerId: source.containerId ?? null }) as MutableElement;
      const resized = { ...source, width: fresh.width, height: fresh.height, version: source.version + 1 } as MutableElement;
      const container = source.containerId ? this.elements.find((candidate) => candidate.id === source.containerId) as MutableElement | undefined : undefined;
      return { ...resized, ...(container ? this.labelPosition(container, resized, source.verticalAlign) : {}) } as WebdrawElement;
    });
    this.emitChange();
  }

  private setFontFamily(value: number) { this.fontFamily = value; this.updateTextStyle({ fontFamily: value }); }
  private setFontSize(value: number) { this.fontSize = value; this.updateTextStyle({ fontSize: value }); }
  private changeFontSize(delta: number) { this.setFontSize(Math.max(8, Math.min(96, this.fontSize + delta))); }
  private setTextAlign(value: TextAlign) { this.textAlign = value; this.updateTextStyle({ textAlign: value }); }
  private setVerticalAlign(value: VerticalAlign) { this.verticalAlign = value; this.updateTextStyle({ verticalAlign: value }); }
  private setArrowType(value: typeof this.arrowType) {
    this.arrowType = value;
    this.updateSelected({ roundness: value === "round" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null, elbowed: value === "elbow" });
    this.requestUpdate();
  }
  private setArrowhead(side: "start" | "end", value: Arrowhead) {
    if (side === "start") this.startArrowhead = value; else this.endArrowhead = value;
    this.updateSelected({ [side === "start" ? "startArrowhead" : "endArrowhead"]: value });
    this.requestUpdate();
  }

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

  private snappedDelta(ids: Set<string>, dx: number, dy: number) {
    const moving = this.elements.filter((item) => this.selectedIds.has(item.id)).map((item) => this.bounds(item as MutableElement));
    const fixed = this.elements.filter((item) => !ids.has(item.id)).map((item) => this.bounds(item as MutableElement));
    if (!moving.length || !fixed.length) return { x: dx, y: dy };
    const coordinates = (boxes: ReturnType<WebDraw["bounds"]>[], axis: "x" | "y") => boxes.flatMap((box) => axis === "x" ? [box.x, box.x + box.width / 2, box.x + box.width] : [box.y, box.y + box.height / 2, box.y + box.height]);
    const nearest = (sources: number[], targets: number[], delta: number) => {
      let adjustment = 7 / this.zoom;
      for (const source of sources) for (const target of targets) if (Math.abs(target - source - delta) < Math.abs(adjustment)) adjustment = target - source - delta;
      return Math.abs(adjustment) < 7 / this.zoom ? delta + adjustment : delta;
    };
    return { x: nearest(coordinates(moving, "x"), coordinates(fixed, "x"), dx), y: nearest(coordinates(moving, "y"), coordinates(fixed, "y"), dy) };
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
  private sendToBack = () => this.moveSelectedToEdge("back");
  private bringToFront = () => this.moveSelectedToEdge("front");

  private moveSelectedLayer(direction: -1 | 1) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    const ids = this.movingElementIds();
    const next = [...this.elements];
    if (direction < 0) {
      for (let index = 1; index < next.length; index++) if (ids.has(next[index].id) && !ids.has(next[index - 1].id)) [next[index - 1], next[index]] = [next[index], next[index - 1]];
    } else {
      for (let index = next.length - 2; index >= 0; index--) if (ids.has(next[index].id) && !ids.has(next[index + 1].id)) [next[index], next[index + 1]] = [next[index + 1], next[index]];
    }
    this.elements = next;
    this.emitChange();
  }

  private moveSelectedToEdge(edge: "back" | "front") {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    const ids = this.movingElementIds(), selected = this.elements.filter((item) => ids.has(item.id)), rest = this.elements.filter((item) => !ids.has(item.id));
    this.elements = edge === "back" ? [...selected, ...rest] : [...rest, ...selected];
    this.emitChange();
  }

  private toggleSelectedLock = () => {
    const locked = this.elements.some((item) => this.selectedIds.has(item.id) && item.locked);
    this.updateSelected({ locked: !locked });
  };

  private copyStyles = () => {
    const item = this.elements.find((element) => this.selectedIds.has(element.id)) as MutableElement | undefined;
    if (!item) return;
    const label = item.type === "text" ? item : this.boundLabel(item), values: Record<string, any> = { ...item, ...(label ? { fontFamily: label.fontFamily, fontSize: label.fontSize, textAlign: label.textAlign, verticalAlign: label.verticalAlign } : {}) };
    this.styleClipboard = Object.fromEntries(["strokeColor", "backgroundColor", "fillStyle", "strokeWidth", "strokeStyle", "roughness", "opacity", "fontFamily", "fontSize", "textAlign", "verticalAlign", "startArrowhead", "endArrowhead", "roundness", "elbowed"].filter((key) => values[key] !== undefined).map((key) => [key, values[key]]));
  };

  private pasteStyles = () => {
    if (!this.styleClipboard) return;
    const textKeys = ["fontFamily", "fontSize", "textAlign", "verticalAlign"], text = Object.fromEntries(Object.entries(this.styleClipboard).filter(([key]) => textKeys.includes(key)));
    const shape = Object.fromEntries(Object.entries(this.styleClipboard).filter(([key]) => !textKeys.includes(key)));
    if (Object.keys(shape).length) this.updateSelected(shape);
    if (Object.keys(text).length) this.updateTextStyle(text);
  };

  private alignSelected(key: string) {
    const selected = this.elements.filter((item) => this.selectedIds.has(item.id));
    if (selected.length < 2) return;
    const boxes = selected.map((item) => this.bounds(item as MutableElement));
    const target = key === "ArrowLeft" ? Math.min(...boxes.map((box) => box.x)) : key === "ArrowRight" ? Math.max(...boxes.map((box) => box.x + box.width)) : key === "ArrowUp" ? Math.min(...boxes.map((box) => box.y)) : Math.max(...boxes.map((box) => box.y + box.height));
    this.checkpoint();
    const offsets = new Map(selected.map((item, index) => [item.id, key === "ArrowLeft" ? { x: target - boxes[index].x, y: 0 } : key === "ArrowRight" ? { x: target - boxes[index].x - boxes[index].width, y: 0 } : key === "ArrowUp" ? { x: 0, y: target - boxes[index].y } : { x: 0, y: target - boxes[index].y - boxes[index].height }]));
    for (const selectedItem of selected) for (const binding of selectedItem.boundElements ?? []) if (binding.type === "text") offsets.set(binding.id, offsets.get(selectedItem.id)!);
    this.elements = this.elements.map((item) => { const offset = offsets.get(item.id); return offset ? { ...item, x: item.x + offset.x, y: item.y + offset.y, version: item.version + 1 } as WebdrawElement : item; });
    this.emitChange();
  }

  private flipSelected(axis: "horizontal" | "vertical") {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = this.elements.map((item) => this.selectedIds.has(item.id) ? { ...item, customData: { ...(item.customData ?? {}), [axis === "horizontal" ? "webdrawFlipX" : "webdrawFlipY"]: !(item as MutableElement).customData?.[axis === "horizontal" ? "webdrawFlipX" : "webdrawFlipY"] }, version: item.version + 1 } as WebdrawElement : item);
    this.emitChange();
  }

  private cycleSelectedShape(direction: -1 | 1) {
    const types = ["rectangle", "diamond", "ellipse"] as const;
    const selected = this.elements.find((item) => this.selectedIds.has(item.id));
    const index = selected ? types.indexOf(selected.type as typeof types[number]) : -1;
    if (!selected || index < 0) return;
    this.updateSelected({ type: types[(index + direction + types.length) % types.length] });
  }

  private createFlowchartNode(key: string) {
    const source = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement | undefined;
    if (!source || ["text", "line", "arrow", "freedraw", "image", "frame", "embeddable"].includes(source.type)) return;
    const horizontal = key === "ArrowLeft" || key === "ArrowRight", sign = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
    const distance = (horizontal ? Math.max(source.width, 120) : Math.max(source.height, 80)) + 100;
    const dx = horizontal ? sign * distance : 0, dy = horizontal ? 0 : sign * distance;
    const sourceIds = this.movingElementIds(), originals = this.elements.filter((item) => sourceIds.has(item.id));
    const ids = new Map(originals.map((item) => [item.id, this.ownerDocument.defaultView!.crypto.randomUUID()]));
    const copies = originals.map((item) => { const mutable = item as MutableElement; return { ...structuredClone(item), id: ids.get(item.id)!, x: item.x + dx, y: item.y + dy, containerId: mutable.containerId ? ids.get(mutable.containerId) ?? null : null, frameId: null, boundElements: item.boundElements?.map((binding) => ({ ...binding, id: ids.get(binding.id) ?? binding.id })) ?? null, version: 1 } as WebdrawElement; });
    const connector = newLinearElement({ type: "arrow", x: source.x + source.width / 2, y: source.y + source.height / 2, points: [[0, 0], [dx, dy]] as any, strokeColor: this.strokeColor, backgroundColor: "transparent", strokeWidth: this.strokeWidth, strokeStyle: this.strokeStyle, roughness: this.roughness, opacity: this.opacity, roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS } }) as WebdrawElement;
    this.checkpoint(); this.elements = [...this.elements, connector, ...copies]; this.selectedIds = new Set([ids.get(source.id)!]); this.emitChange();
  }

  private navigateFlowchart(key: string) {
    const source = this.elements.find((item) => this.selectedIds.has(item.id)) as MutableElement | undefined;
    if (!source) return;
    const center = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const candidates = this.elements.filter((item) => item.id !== source.id && !(item as MutableElement).containerId && !["line", "arrow"].includes(item.type)).map((item) => {
      const box = this.bounds(item as MutableElement), dx = box.x + box.width / 2 - center.x, dy = box.y + box.height / 2 - center.y;
      const forward = key === "ArrowLeft" ? -dx : key === "ArrowRight" ? dx : key === "ArrowUp" ? -dy : dy;
      const cross = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
      return { item, forward, score: Math.hypot(dx, dy) + cross };
    }).filter((candidate) => candidate.forward > 0).sort((a, b) => a.score - b.score);
    if (candidates[0]) { this.selectedIds = new Set([candidates[0].item.id]); this.syncStyleFromElement(candidates[0].item as MutableElement); this.requestUpdate(); }
  }

  private fitElements(elements: readonly WebdrawElement[]) {
    if (!elements.length || !this.canvas) return;
    const boxes = elements.map((item) => this.bounds(item as MutableElement));
    const minX = Math.min(...boxes.map((box) => box.x)), minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width)), maxY = Math.max(...boxes.map((box) => box.y + box.height));
    const rect = this.canvas.getBoundingClientRect(), padding = 64;
    this.zoom = Math.min(1, Math.max(.1, Math.min((rect.width - padding * 2) / Math.max(1, maxX - minX), (rect.height - padding * 2) / Math.max(1, maxY - minY))));
    this.pan = { x: rect.width / 2 - (minX + maxX) / 2 * this.zoom, y: rect.height / 2 - (minY + maxY) / 2 * this.zoom };
    this.requestUpdate();
  }

  private pastePlaintext = async () => {
    try {
      const text = await this.ownerDocument.defaultView?.navigator.clipboard.readText();
      if (!text || !this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.startTextEditing({ x: (rect.width / 2 - this.pan.x) / this.zoom, y: (rect.height / 2 - this.pan.y) / this.zoom });
      this.textDraft = text;
      this.commitText();
    } catch { /* Clipboard permission is browser-controlled. */ }
  };

  private pickColor = async () => {
    const EyeDropper = (this.ownerDocument.defaultView as any)?.EyeDropper;
    if (!EyeDropper) return;
    try { this.setStrokeColor((await new EyeDropper().open()).sRGBHex); } catch { /* User cancelled. */ }
  };

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
    if (element.angle || element.customData?.webdrawFlipX || element.customData?.webdrawFlipY) {
      context.translate(centerX, centerY);
      if (element.angle) context.rotate(element.angle);
      context.scale(element.customData?.webdrawFlipX ? -1 : 1, element.customData?.webdrawFlipY ? -1 : 1);
      context.translate(-centerX, -centerY);
    }
    if (element.customData?.webdrawSticky) {
      const radius = element.customData?.webdrawRound === false ? 3 : 12;
      context.beginPath(); context.roundRect(element.x, element.y, element.width, element.height, radius);
      context.fillStyle = element.backgroundColor; context.fill(); context.strokeStyle = stroke; context.lineWidth = Math.max(1, element.strokeWidth / 2); context.stroke();
      const created = element.customData?.stickyCreated ?? element.created ?? Date.now();
      const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(created);
      context.fillStyle = stroke; context.font = "14px Assistant, sans-serif"; context.textAlign = "right"; context.textBaseline = "alphabetic"; context.fillText(date, element.x + element.width - 16, element.y + element.height - 18); context.textAlign = "start";
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
      if (image?.complete) {
        const crop = element.customData?.crop;
        crop ? context.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, crop.width * image.naturalWidth, crop.height * image.naturalHeight, element.x, element.y, element.width, element.height) : context.drawImage(image, element.x, element.y, element.width, element.height);
      }
    }
    else if (element.type === "line" || element.type === "arrow") {
      let points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y] as [number, number]);
      if (element.elbowed && points.length === 2) points = [points[0], [points[1][0], points[0][1]], points[1]];
      element.roundness && points.length > 2 ? roughCanvas.curve(points, options) : roughCanvas.linearPath(points, options);
      if (element.type === "arrow" && points.length > 1) {
        if (element.startArrowhead) this.paintArrowhead(context, points[1], points[0], element, element.startArrowhead, stroke);
        if (element.endArrowhead) this.paintArrowhead(context, points.at(-2)!, points.at(-1)!, element, element.endArrowhead, stroke);
      }
    } else if (element.type === "freedraw") {
      const points = element.points.map(([x, y]: number[]) => [element.x + x, element.y + y]);
      const outline = getStroke(points, { size: element.strokeWidth * 4, thinning: .6, smoothing: .5, streamline: .5, simulatePressure: element.simulatePressure });
      if (outline.length) { context.beginPath(); context.moveTo(outline[0][0], outline[0][1]); for (const [x, y] of outline.slice(1)) context.lineTo(x, y); context.closePath(); context.fillStyle = stroke; context.fill(); }
    } else if (element.type === "text") {
      context.fillStyle = stroke; context.font = `${element.fontSize}px ${this.fontName(element.fontFamily)}`; context.textBaseline = "top"; context.textAlign = (element.textAlign ?? "left") as CanvasTextAlign;
      const x = element.textAlign === "center" ? element.x + element.width / 2 : element.textAlign === "right" ? element.x + element.width : element.x;
      String(element.text).split("\n").forEach((line, index) => context.fillText(line, x, element.y + index * element.fontSize * (element.lineHeight ?? 1.25)));
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

  private fontName(fontFamily: number) {
    if (fontFamily === FONT_FAMILY.Nunito) return "Nunito, Assistant, sans-serif";
    if (fontFamily === FONT_FAMILY["Comic Shanns"]) return "'Comic Shanns', Cascadia, monospace";
    if (fontFamily === FONT_FAMILY.Cascadia) return "Cascadia, monospace";
    if (fontFamily === FONT_FAMILY.Helvetica || fontFamily === FONT_FAMILY.Assistant) return "Assistant, sans-serif";
    return "Excalifont, Virgil, sans-serif";
  }

  private paintArrowhead(context: CanvasRenderingContext2D, from: [number, number], to: [number, number], element: MutableElement, type: Arrowhead, stroke = element.strokeColor) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), size = 14 + element.strokeWidth * 2;
    const left: [number, number] = [to[0] - Math.cos(angle - Math.PI / 6) * size, to[1] - Math.sin(angle - Math.PI / 6) * size];
    const right: [number, number] = [to[0] - Math.cos(angle + Math.PI / 6) * size, to[1] - Math.sin(angle + Math.PI / 6) * size];
    context.save(); context.strokeStyle = stroke; context.fillStyle = stroke; context.lineWidth = element.strokeWidth; context.lineCap = "round"; context.beginPath();
    if (type === "circle") { context.arc(to[0], to[1], size / 3, 0, Math.PI * 2); context.fill(); }
    else if (type === "diamond") { const back = [to[0] - Math.cos(angle) * size, to[1] - Math.sin(angle) * size]; context.moveTo(to[0], to[1]); context.lineTo(...left); context.lineTo(back[0], back[1]); context.lineTo(...right); context.closePath(); context.fill(); }
    else if (type === "bar") { const half = size / 2; context.moveTo(to[0] + Math.cos(angle + Math.PI / 2) * half, to[1] + Math.sin(angle + Math.PI / 2) * half); context.lineTo(to[0] - Math.cos(angle + Math.PI / 2) * half, to[1] - Math.sin(angle + Math.PI / 2) * half); context.stroke(); }
    else { context.moveTo(...left); context.lineTo(to[0], to[1]); context.lineTo(...right); type === "triangle" ? (context.closePath(), context.fill()) : context.stroke(); }
    context.restore();
  }

  private paintSelection(context: CanvasRenderingContext2D) {
    context.save(); context.strokeStyle = "#6965db"; context.lineWidth = 1 / this.zoom; context.setLineDash([]);
    for (const item of this.elements.filter((element) => this.selectedIds.has(element.id))) {
      const box = this.bounds(item as MutableElement), gap = 4 / this.zoom;
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      context.save(); context.translate(center.x, center.y); context.rotate((item as MutableElement).angle ?? 0); context.translate(-center.x, -center.y);
      context.strokeRect(box.x - gap, box.y - gap, box.width + gap * 2, box.height + gap * 2);
      if (item.id === this.editingLinearId && (item as MutableElement).points) {
        context.fillStyle = this.theme === "dark" ? "#1e1e1e" : "#ffffff";
        for (const [x, y] of (item as MutableElement).points) { context.beginPath(); context.arc(item.x + x, item.y + y, 5 / this.zoom, 0, Math.PI * 2); context.fill(); context.stroke(); }
      } else if (this.selectedIds.size === 1 && !(item as MutableElement).locked) {
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
