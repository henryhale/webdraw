import { LitElement, html, nothing, type PropertyValues } from "lit";
import rough from "roughjs/bin/rough";
import pngText from "png-chunk-text";
import encodePng from "png-chunks-encode";
import extractPng from "png-chunks-extract";
import {
  FONT_FAMILY,
  FRAME_STYLE,
  ROUNDNESS,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  STICKY_NOTE_BACKGROUND_PICKS,
  DEFAULT_STICKY_NOTE_BG,
  applyDarkModeFilter,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  LIBRARY_DISABLED_TYPES,
} from "@excalidraw/common";
import {
  FlowChartNavigator,
  deepCopyElement,
  getFrameLikeTitle,
  newElement,
  newArrowElement,
  newEmbeddableElement,
  newFreeDrawElement,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newStickyNoteElement,
  normalizeStickyNote,
  canChangeRoundness,
  isUsingAdaptiveRadius,
  newElementWith,
} from "@excalidraw/element";
import { edgeIcon, icon, logoIcon, sloppinessIcon } from "./icons";
import { LilitaFontFaces } from "./fonts/Lilita";
import { SHORTCUT_GROUPS, shortcutFor } from "./shortcuts";
import {
  elementBounds,
  elementAbsoluteBox,
  elementTransformHandles,
  cropImageWithExcalidraw,
  commitTextWithExcalidraw,
  commonBounds,
  addChildrenToNewFrameWithExcalidraw,
  bindArrowEndpointWithExcalidraw,
  alignElementsWithExcalidraw,
  appendLinearPointWithExcalidraw,
  createFlowchartNodeWithExcalidraw,
  dragElementsWithExcalidraw,
  dragNewShapeWithExcalidraw,
  duplicateElementsWithExcalidraw,
  duplicateExternalElementsWithExcalidraw,
  extendFreeDrawWithExcalidraw,
  finishLinearWithExcalidraw,
  flipElementsWithExcalidraw,
  fillRegionWithExcalidraw,
  hitElements,
  linearPointIndexAt,
  linearPoints,
  moveLinearPointWithExcalidraw,
  moveElementsInLayerWithExcalidraw,
  renderExcalidrawElements,
  renderExcalidrawElementsToSvg,
  removeElementsWithExcalidraw,
  reconcileFrameMembershipWithExcalidraw,
  replaceElementWithExcalidraw,
  selectElementsWithinExcalidraw,
  selectionTransformHandleAt,
  selectionTransformHandles,
  selectedElementsWithBindings,
  groupElementsWithExcalidraw,
  ungroupElementsWithExcalidraw,
  transformElementsWithExcalidraw,
  textElementAngle,
  updateTextStylesWithExcalidraw,
  updateElementsWithExcalidraw,
  type ExcalidrawImageCache,
} from "./excalidraw-engine";
import type {
  Arrowhead,
  TextAlign,
  Tool,
  VerticalAlign,
  WebdrawBinaryFileData,
  WebdrawBinaryFiles,
  WebdrawElement,
  WebdrawInitialData,
  WebdrawTheme,
} from "./types";
import {
  cursorForHandle,
  encodeSceneMetadata,
  isMobileBreakpoint,
  normalizeBounds,
  type Point,
  type ResizeHandle,
} from "./utils";
import "./styles.scss";

export type {
  WebdrawBinaryFileData,
  WebdrawBinaryFiles,
  WebdrawElement,
  WebdrawInitialData,
  WebdrawTheme,
} from "./types";

type MutableElement = WebdrawElement & Record<string, any>;
type LibraryItem = {
  id: string;
  elements: readonly WebdrawElement[];
  name?: string;
};
type TextEdit = Point & {
  elementId?: string;
  containerId?: string;
  fontSize: number;
  fontFamily: number;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  width?: number;
  angle?: number;
};
type Drag = {
  mode:
    | "draw"
    | "move"
    | "pan"
    | "select"
    | "erase"
    | "resize"
    | "rotate"
    | "point"
    | "crop"
    | "bucket";
  start: Point;
  last: Point;
  draftId?: string;
  originalElements?: Map<string, WebdrawElement>;
  pan?: Point;
  checkpointed?: boolean;
  handle?: ResizeHandle;
  element?: MutableElement;
  pointIndex?: number;
  multiPoint?: boolean;
  bindingDisabled?: boolean;
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

const CANVAS_COLORS = {
  light: ["#ffffff", "#f8f9fa", "#f5faff", "#fff9db", "#fff5f5"],
  dark: ["#121212", "#161819", "#15191c", "#1a1a05", "#1c1715"],
} as const;
const installedFonts = new WeakSet<Document>();

const edgeRoundness = (type: string, round: boolean) =>
  round
    ? {
        type: isUsingAdaptiveRadius(type)
          ? ROUNDNESS.ADAPTIVE_RADIUS
          : ROUNDNESS.PROPORTIONAL_RADIUS,
      }
    : null;

export class WebDraw extends LitElement {
  static properties = {
    theme: { type: String, reflect: true },
    viewModeEnabled: { type: Boolean, attribute: "view-mode", reflect: true },
    zenModeEnabled: { type: Boolean, attribute: "zen-mode", reflect: true },
    gridModeEnabled: { type: Boolean, attribute: "grid-mode", reflect: true },
    libraryEnabled: { type: String, attribute: "library-enabled" },
    library: { type: String },
    storageKey: { type: String, attribute: "storage-key" },
    initialData: { attribute: false },
    elements: { attribute: false },
    tool: { state: true },
    zoom: { state: true },
    menuOpen: { state: true },
    moreToolsOpen: { state: true },
    libraryOpen: { state: true },
    libraryItems: { state: true },
    libraryQuery: { state: true },
    dialog: { state: true },
    searchQuery: { state: true },
    editingText: { state: true },
    selectedIds: { state: true },
    contextMenu: { state: true },
    toolLocked: { state: true },
    propertiesOpen: { state: true },
    preferencesOpen: { state: true },
    editingLinearId: { state: true },
    snapToObjects: { state: true },
    croppingImageId: { state: true },
    editingFrameId: { state: true },
    mobile: { state: true },
  };

  theme: WebdrawTheme = "auto";
  viewModeEnabled = false;
  zenModeEnabled = false;
  gridModeEnabled = false;
  libraryEnabled: "on" | "off" = "on";
  library: string | null = null;
  storageKey = "webdraw-library";
  initialData?: WebdrawInitialData;
  elements: WebdrawElement[] = [];
  tool: Tool = "selection";
  zoom = 1;
  menuOpen = false;
  moreToolsOpen = false;
  libraryOpen = false;
  libraryItems: LibraryItem[] = [];
  libraryQuery = "";
  dialog: "export" | "help" | "search" | "commands" | null = null;
  searchQuery = "";
  editingText: TextEdit | null = null;
  selectedIds = new Set<string>();
  contextMenu: Point | null = null;
  toolLocked = false;
  propertiesOpen = true;
  preferencesOpen = false;
  editingLinearId: string | null = null;
  snapToObjects = false;
  croppingImageId: string | null = null;
  editingFrameId: string | null = null;
  mobile = false;

  private canvas?: HTMLCanvasElement;
  private observer?: ResizeObserver;
  private systemTheme?: MediaQueryList;
  private drag: Drag | null = null;
  private selectionRect: { start: Point; end: Point } | null = null;
  private pan = { x: 0, y: 0 };
  private history: WebdrawElement[][] = [];
  private future: WebdrawElement[][] = [];
  private strokeColor = DEFAULT_ELEMENT_PROPS.strokeColor;
  private backgroundColor = "transparent";
  private canvasColor = "#ffffff";
  private strokeWidth = 2;
  private roughness = 0;
  private edgeRound = true;
  private fillStyle: "hachure" | "cross-hatch" | "solid" | "zigzag" = "hachure";
  private strokeStyle: "solid" | "dashed" | "dotted" = "solid";
  private opacity = 100;
  private opacityCheckpointed = false;
  private fontFamily = FONT_FAMILY.Nunito;
  private fontSize = 20;
  private textAlign: TextAlign = "left";
  private verticalAlign: VerticalAlign = "top";
  private arrowType: "sharp" | "round" | "elbow" = "round";
  private startArrowhead: Arrowhead = null;
  private endArrowhead: Arrowhead = "arrow";
  private spacePressed = false;
  private pendingLinearId: string | null = null;
  private pendingLinearBindingDisabled = false;
  private styleClipboard: Record<string, unknown> | null = null;
  private textDraft = "";
  private exportScale = 1;
  private exportBackground = true;
  private exportDarkMode = false;
  private exportEmbedScene = false;
  private exportSelectionOnly = false;
  private exportPadding = 10;
  private imageCache: ExcalidrawImageCache = new Map();
  private files: WebdrawBinaryFiles = {};
  private clipboard: WebdrawElement[] = [];
  private flowchartNavigator = new FlowChartNavigator();

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.tabIndex = 0;
    this.setAttribute("role", "application");
    this.setAttribute("aria-label", "Webdraw canvas");
    this.addEventListener("keydown", this.onKeyDown);
    this.addEventListener("keyup", this.onKeyUp);
    this.systemTheme = this.ownerDocument.defaultView?.matchMedia(
      "(prefers-color-scheme: dark)",
    );
    this.systemTheme?.addEventListener("change", this.onSystemThemeChange);
    this.ownerDocument.fonts.addEventListener(
      "loadingdone",
      this.onFontsLoaded,
    );
    if (!installedFonts.has(this.ownerDocument)) {
      const moduleUrl = import.meta.url;
      for (const { uri, descriptors } of LilitaFontFaces) {
        const url = new URL(`./fonts/Lilita/${uri}`, moduleUrl);
        this.ownerDocument.fonts.add(
          new FontFace(
            "Lilita One",
            `url(${JSON.stringify(url.href)})`,
            descriptors,
          ),
        );
      }
      installedFonts.add(this.ownerDocument);
    }
    this.loadLibrary();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.removeEventListener("keydown", this.onKeyDown);
    this.removeEventListener("keyup", this.onKeyUp);
    this.systemTheme?.removeEventListener("change", this.onSystemThemeChange);
    this.ownerDocument.fonts.removeEventListener(
      "loadingdone",
      this.onFontsLoaded,
    );
    super.disconnectedCallback();
  }

  protected firstUpdated() {
    this.canvas = this.querySelector("canvas") ?? undefined;
    this.observer = new ResizeObserver(() => {
      this.updateFormFactor();
      this.paint();
    });
    this.updateFormFactor();
    this.observer.observe(this);
    this.dispatchEvent(
      new CustomEvent("webdraw-ready", { bubbles: true, composed: true }),
    );
    this.paint();
  }

  protected willUpdate(changes: PropertyValues<this>) {
    if (changes.has("library") || changes.has("storageKey")) this.loadLibrary();
    if (changes.has("initialData") && this.initialData) {
      this.elements = structuredClone([...(this.initialData.elements ?? [])]);
      this.files = structuredClone(this.initialData.files ?? {});
      this.loadSceneImages();
      const state = this.initialData.appState;
      if (state?.theme) this.theme = state.theme;
      if (state?.viewBackgroundColor)
        this.canvasColor = state.viewBackgroundColor;
      const zoom =
        typeof state?.zoom === "number" ? state.zoom : state?.zoom?.value;
      if (zoom) this.zoom = zoom;
      this.pan = {
        x: (state?.scrollX ?? 0) * this.zoom,
        y: (state?.scrollY ?? 0) * this.zoom,
      };
    }
  }

  protected updated() {
    this.paint();
    if (this.dialog === "export") this.paintExportPreview();
    if (this.editingText) {
      const area = this.querySelector<HTMLTextAreaElement>(
        ".webdraw-text-editor",
      );
      area?.focus();
      if (area) {
        area.style.height = "0";
        area.style.height = `${area.scrollHeight}px`;
      }
    }
    if (this.dialog === "search")
      this.querySelector<HTMLInputElement>(".search-menu input")?.focus();
    if (this.dialog === "commands")
      this.querySelector<HTMLInputElement>(".command-menu input")?.focus();
  }

  getSceneElements(): readonly WebdrawElement[] {
    return this.elements;
  }

  getAppState() {
    return {
      theme: this.theme,
      viewBackgroundColor: this.canvasColor,
      zoom: { value: this.zoom },
      scrollX: this.pan.x / this.zoom,
      scrollY: this.pan.y / this.zoom,
      activeTool: { type: this.tool },
      currentItemRoundness: this.edgeRound ? "round" : "sharp",
      selectedElementIds: Object.fromEntries(
        [...this.selectedIds].map((id) => [id, true]),
      ),
    };
  }

  updateScene(scene: WebdrawInitialData) {
    this.checkpoint();
    if (scene.elements) this.elements = structuredClone([...scene.elements]);
    if (scene.files) {
      this.files = structuredClone(scene.files);
      this.loadSceneImages();
    }
    if (scene.appState?.theme) this.theme = scene.appState.theme;
    if (scene.appState?.viewBackgroundColor)
      this.canvasColor = scene.appState.viewBackgroundColor;
    if (scene.appState?.currentItemRoundness)
      this.edgeRound = scene.appState.currentItemRoundness === "round";
    const zoom =
      typeof scene.appState?.zoom === "number"
        ? scene.appState.zoom
        : scene.appState?.zoom?.value;
    if (zoom) this.zoom = zoom;
    if (
      scene.appState?.scrollX !== undefined ||
      scene.appState?.scrollY !== undefined
    ) {
      this.pan = {
        x: (scene.appState.scrollX ?? 0) * this.zoom,
        y: (scene.appState.scrollY ?? 0) * this.zoom,
      };
    }
    this.emitChange();
  }

  addFiles(files: readonly WebdrawBinaryFileData[]) {
    this.files = {
      ...this.files,
      ...Object.fromEntries(files.map((file) => [file.id, file])),
    };
    this.loadSceneImages();
  }

  resetScene() {
    this.checkpoint();
    this.elements = [];
    this.files = {};
    this.imageCache.clear();
    this.selectedIds = new Set();
    this.emitChange();
  }

  private renderTool([tool, label, shortcut]: readonly [Tool, string, string]) {
    const active = this.tool === tool;
    return html` <button
      class="ToolIcon ToolIcon_type_toggle ${active ? "ToolIcon--checked" : ""}"
      title=${label}
      aria-label=${label}
      aria-pressed=${active}
      data-testid=${`toolbar-${tool}`}
      @click=${() => this.setTool(tool)}
    >
      <span class="ToolIcon__icon">${icon(tool)}</span>
      ${shortcut
        ? html`<span class="ToolIcon__keybinding">${shortcut}</span>`
        : nothing}
    </button>`;
  }

  protected render() {
    const cursor = this.viewModeEnabled
      ? "default"
      : this.tool === "hand"
        ? "grab"
        : this.tool === "selection"
          ? "default"
          : this.tool === "text"
            ? "text"
            : "crosshair";
    return html` <div
      class="webdraw ${this.isDarkTheme() ? "theme--dark" : ""} ${this.mobile
        ? "webdraw--mobile"
        : ""}"
      dir="ltr"
      style=${`--canvas-background: ${this.canvasColor}; --canvas-cursor: ${cursor}`}
    >
      <canvas
        class="webdraw__canvas interactive"
        aria-label="Drawing canvas"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @pointerleave=${this.onPointerLeave}
        @dblclick=${this.onDoubleClick}
        @contextmenu=${this.onContextMenu}
        @wheel=${this.onWheel}
      ></canvas>
      <div class="webdraw-embeds">
        ${this.elements
          .filter((item) => item.type === "embeddable")
          .map((item) => {
            const element = item as MutableElement,
              url = this.getEmbedUrl(element);
            return url
              ? html`<iframe
                  title="Web embed"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  src=${url}
                  class=${this.viewModeEnabled ||
                  this.selectedIds.has(element.id)
                    ? "active"
                    : ""}
                  style=${`left:${element.x * this.zoom + this.pan.x}px;top:${element.y * this.zoom + this.pan.y}px;width:${element.width * this.zoom}px;height:${element.height * this.zoom}px;transform:rotate(${element.angle ?? 0}rad)`}
                ></iframe>`
              : nothing;
          })}
      </div>
      <div class="webdraw-frame-names">
        ${this.elements
          .filter((item) => item.type === "frame")
          .map(
            (frame) =>
              html` <div
                class="webdraw-frame-name"
                style=${`left:${frame.x * this.zoom + this.pan.x}px;top:${frame.y * this.zoom + this.pan.y - (FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight + FRAME_STYLE.nameOffsetY) * this.zoom}px;max-width:${frame.width * this.zoom}px;font-size:${FRAME_STYLE.nameFontSize * this.zoom}px;color:${this.isDarkTheme() ? FRAME_STYLE.nameColorDarkTheme : FRAME_STYLE.nameColorLightTheme}`}
                @pointerdown=${(event: PointerEvent) =>
                  this.onPointerDown(event)}
                @dblclick=${(event: MouseEvent) => {
                  event.stopPropagation();
                  this.checkpoint();
                  this.editingFrameId = frame.id;
                }}
              >
                ${this.editingFrameId === frame.id
                  ? html`<input
                      autofocus
                      .value=${getFrameLikeTitle(frame)}
                      size=${Math.max(1, getFrameLikeTitle(frame).length + 1)}
                      @input=${(event: InputEvent) => {
                        this.elements = updateElementsWithExcalidraw(
                          this.elements,
                          new Set([frame.id]),
                          { name: (event.target as HTMLInputElement).value },
                        ) as WebdrawElement[];
                      }}
                      @blur=${() => {
                        this.editingFrameId = null;
                        this.emitChange();
                      }}
                      @keydown=${(event: KeyboardEvent) => {
                        if (event.key === "Enter" || event.key === "Escape")
                          (event.target as HTMLInputElement).blur();
                      }}
                    />`
                  : getFrameLikeTitle(frame)}
              </div>`,
          )}
      </div>

      <div class="layer-ui__wrapper">
        ${this.zenModeEnabled
          ? nothing
          : html` <div class="FixedSideContainer FixedSideContainer_side_top">
              <div class="App-menu App-menu_top">
                <div class="App-menu_top__left">
                  ${this.mobile ? nothing : this.renderMenuStack()}
                </div>

                ${this.viewModeEnabled
                  ? nothing
                  : html` <section class="shapes-section" aria-label="Shapes">
                      <div class="App-toolbar-container">
                        <div class="Island App-toolbar" data-viewport-ui="top">
                          <div class="Stack Stack_horizontal toolbar-row">
                            <button
                              class="ToolIcon ToolIcon_type_toggle ${this
                                .toolLocked
                                ? "ToolIcon--checked"
                                : ""}"
                              title="Keep selected tool active (Q)"
                              aria-label="Keep selected tool active"
                              data-testid="toolbar-lock"
                              aria-pressed=${this.toolLocked}
                              @click=${() =>
                                (this.toolLocked = !this.toolLocked)}
                            >
                              <span class="ToolIcon__icon"
                                >${icon("lock")}</span
                              >
                            </button>
                            <span class="App-toolbar__divider"></span>
                            ${TOOL_META.map((tool) => this.renderTool(tool))}
                            <span class="App-toolbar__divider"></span>
                            <button
                              class="ToolIcon ToolIcon_type_toggle ${this
                                .moreToolsOpen
                                ? "ToolIcon--checked"
                                : ""}"
                              title="More tools"
                              aria-label="More tools"
                              aria-expanded=${this.moreToolsOpen}
                              @click=${() => {
                                this.moreToolsOpen = !this.moreToolsOpen;
                                this.menuOpen = false;
                                this.libraryOpen = false;
                              }}
                            >
                              <span class="ToolIcon__icon"
                                >${icon("more")}</span
                              >
                            </button>
                          </div>
                          ${this.moreToolsOpen
                            ? this.renderMoreTools()
                            : nothing}
                        </div>
                      </div>
                    </section>`}

                <div
                  class="layer-ui__wrapper__top-right"
                  ?hidden=${this.libraryEnabled !== "on" && !this.mobile}
                >
                  ${this.libraryEnabled === "on"
                    ? html` <button
                        class="library-button"
                        @click=${() => {
                          this.libraryOpen = !this.libraryOpen;
                          this.menuOpen = false;
                          this.moreToolsOpen = false;
                        }}
                      >
                        ${icon("library")}<span>Library</span>
                      </button>`
                    : nothing}
                  ${this.mobile && !this.viewModeEnabled
                    ? html` <button
                          class="ToolIcon ToolIcon_type_toggle ${this.toolLocked
                            ? "ToolIcon--checked"
                            : ""}"
                          title="Keep selected tool active (Q)"
                          aria-label="Keep selected tool active"
                          aria-pressed=${this.toolLocked}
                          @click=${() => (this.toolLocked = !this.toolLocked)}
                        >
                          <span class="ToolIcon__icon">${icon("lock")}</span>
                        </button>
                        ${this.renderTool(TOOL_META[0])}`
                    : nothing}
                  ${this.libraryOpen
                    ? html` <aside class="Island library-panel">
                        <header>
                          <strong>Library</strong
                          ><button
                            aria-label="Close library"
                            @click=${() => (this.libraryOpen = false)}
                          >
                            ×
                          </button>
                        </header>
                        <input
                          class="library-search"
                          type="search"
                          placeholder="Search library"
                          .value=${this.libraryQuery}
                          @input=${(event: Event) =>
                            (this.libraryQuery = (
                              event.target as HTMLInputElement
                            ).value)}
                        />
                        ${this.selectedIds.size
                          ? html`<button
                              class="library-action"
                              @click=${this.addSelectedToLibrary}
                            >
                              Add selection to library
                            </button>`
                          : nothing}
                        ${this.libraryItems.length
                          ? html`<div class="library-items">
                              ${this.libraryItems
                                .filter(
                                  (item) =>
                                    !this.libraryQuery ||
                                    (
                                      item.name ??
                                      item.elements
                                        .map((element) => element.type)
                                        .join(" ")
                                    )
                                      .toLowerCase()
                                      .includes(
                                        this.libraryQuery.toLowerCase(),
                                      ),
                                )
                                .map(
                                  (item) =>
                                    html`<div class="library-item">
                                      <button
                                        @click=${() =>
                                          this.insertLibraryItem(item)}
                                        title="Insert library item"
                                      >
                                        ${item.name ??
                                        item.elements
                                          .map((element) => element.type)
                                          .join(" + ")}</button
                                      ><button
                                        aria-label="Remove library item"
                                        @click=${() =>
                                          this.removeLibraryItem(item.id)}
                                      >
                                        ×
                                      </button>
                                    </div>`,
                                )}
                            </div>`
                          : html`<div class="library-empty">
                              Select an item on canvas to add it here, or pass a
                              library through the library attribute.
                            </div>`}
                      </aside>`
                    : nothing}
                </div>
              </div>
            </div>`}

        <div class="layer-ui__wrapper__footer">
          ${this.mobile
            ? this.renderMobileBar()
            : html` <div class="layer-ui__wrapper__footer-left">
                  <div class="Island zoom-actions">
                    <button
                      @click=${() => this.setZoom(this.zoom - 0.1)}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <button class="zoom-value" @click=${() => this.setZoom(1)}>
                      ${Math.round(this.zoom * 100)}%
                    </button>
                    <button
                      @click=${() => this.setZoom(this.zoom + 0.1)}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                  <div class="Island undo-actions">
                    <button
                      @click=${this.undo}
                      ?disabled=${!this.history.length}
                      aria-label="Undo"
                    >
                      ${icon("undo")}
                    </button>
                    <button
                      @click=${this.redo}
                      ?disabled=${!this.future.length}
                      aria-label="Redo"
                    >
                      ${icon("redo")}
                    </button>
                  </div>
                </div>
                <div class="layer-ui__wrapper__footer-right">
                  <button
                    class="webdraw-floating help-button"
                    title="Help"
                    aria-label="Help"
                    @click=${() => (this.dialog = "help")}
                  >
                    ${icon("help")}
                  </button>
                </div>`}
        </div>
        ${!this.elements.length && !this.viewModeEnabled
          ? this.renderWelcome()
          : nothing}
      </div>

      ${this.dialog ? this.renderDialog() : nothing}
      ${this.contextMenu ? this.renderContextMenu() : nothing}
      ${this.editingText
        ? html` <textarea
            class="webdraw-text-editor"
            aria-label="Text"
            placeholder="Type something"
            rows="1"
            .value=${this.textDraft}
            style=${`left:${this.editingText.x * this.zoom + this.pan.x}px;top:${this.editingText.y * this.zoom + this.pan.y}px;font-size:${this.editingText.fontSize * this.zoom}px;font-family:${this.fontName(this.editingText.fontFamily)};text-align:${this.editingText.textAlign};transform:rotate(${this.editingText.angle ?? 0}rad);transform-origin:top left;${this.editingText.width ? `width:${Math.max(64, this.editingText.width * this.zoom)}px` : ""}`}
            @input=${this.onTextInput}
            @pointerdown=${(event: PointerEvent) => event.stopPropagation()}
            @keydown=${this.onTextKeyDown}
            @blur=${this.commitText}
          ></textarea>`
        : nothing}
      <input
        class="scene-input"
        type="file"
        accept="application/json,.webdraw"
        @change=${this.openScene}
      />
      <input
        class="image-input"
        type="file"
        accept="image/*"
        @change=${this.openImage}
      />
      <input
        class="picker-proxy stroke-picker-proxy"
        type="color"
        .value=${this.strokeColor}
        @input=${(event: InputEvent) =>
          this.setStrokeColor((event.target as HTMLInputElement).value)}
      />
      <input
        class="picker-proxy background-picker-proxy"
        type="color"
        .value=${this.backgroundColor === "transparent"
          ? "#ffffff"
          : this.backgroundColor}
        @input=${(event: InputEvent) =>
          this.setBackground((event.target as HTMLInputElement).value)}
      />
    </div>`;
  }

  private renderMenuStack() {
    return html` <button
        class="webdraw-floating ToolIcon ToolIcon_type_button"
        aria-label="Open menu"
        title="Open menu"
        @click=${() => {
          this.menuOpen = !this.menuOpen;
          this.libraryOpen = false;
          this.moreToolsOpen = false;
        }}
      >
        <span class="ToolIcon__icon">${icon("menu")}</span>
      </button>
      ${this.menuOpen ? this.renderMenu() : nothing}
      ${this.propertiesOpen && (!this.mobile || this.selectedIds.size)
        ? this.renderProperties()
        : nothing}`;
  }

  private renderMobileBar() {
    const selected = this.selectedIds.size > 0;
    return html` <div class="Island mobile-bar">
      <div class="mobile-bar__group">${this.renderMenuStack()}</div>
      <div class="mobile-bar__group mobile-bar__group--center">
        ${selected
          ? html` <button
                class="ToolIcon ToolIcon_type_toggle ${this.propertiesOpen
                  ? "ToolIcon--checked"
                  : ""}"
                title="Shape properties"
                aria-label="Shape properties"
                aria-pressed=${this.propertiesOpen}
                @click=${() => {
                  this.propertiesOpen = !this.propertiesOpen;
                  this.menuOpen = false;
                }}
              >
                <span class="ToolIcon__icon">${icon("preferences")}</span>
              </button>
              <button
                class="ToolIcon ToolIcon_type_button"
                title="Duplicate"
                aria-label="Duplicate"
                @click=${this.duplicateSelected}
              >
                <span class="ToolIcon__icon">${icon("duplicate")}</span>
              </button>
              <button
                class="ToolIcon ToolIcon_type_button"
                title="Delete"
                aria-label="Delete"
                @click=${() => this.deleteSelected()}
              >
                <span class="ToolIcon__icon">${icon("delete")}</span>
              </button>`
          : nothing}
      </div>
      <div class="mobile-bar__group">
        <button
          class="ToolIcon ToolIcon_type_button"
          title="Undo"
          aria-label="Undo"
          ?disabled=${!this.history.length}
          @click=${this.undo}
        >
          <span class="ToolIcon__icon">${icon("undo")}</span>
        </button>
        <button
          class="ToolIcon ToolIcon_type_button"
          title="Redo"
          aria-label="Redo"
          ?disabled=${!this.future.length}
          @click=${this.redo}
        >
          <span class="ToolIcon__icon">${icon("redo")}</span>
        </button>
      </div>
    </div>`;
  }

  private renderMenu() {
    const dark = this.isDarkTheme();
    const colors = CANVAS_COLORS[dark ? "dark" : "light"];
    const selectedCanvasColor =
      dark && this.canvasColor === "#ffffff" ? "#121212" : this.canvasColor;
    const item = (
      name: Parameters<typeof icon>[0],
      label: string,
      action: () => void,
      shortcut = "",
    ) =>
      html` <button
        class=${`dropdown-menu__item ${name === "command" ? "emphasized" : ""}`}
        role="menuitem"
        @click=${action}
      >
        <span class="dropdown-menu__icon">${icon(name)}</span
        ><span>${label}</span>${shortcut
          ? html`<kbd>${shortcut}</kbd>`
          : nothing}
      </button>`;
    return html` <div class="Island dropdown-menu" role="menu">
      ${item(
        "open",
        "Open",
        () => this.querySelector<HTMLInputElement>(".scene-input")?.click(),
        "Ctrl+O",
      )}
      ${item("save", "Save to...", this.saveScene)}
      ${item(
        "export",
        "Export image...",
        () => {
          this.dialog = "export";
          this.menuOpen = false;
        },
        "Ctrl+Shift+E",
      )}
      ${item(
        "command",
        "Command palette",
        () => {
          this.searchQuery = "";
          this.dialog = "commands";
          this.menuOpen = false;
        },
        "Ctrl+/",
      )}
      ${item(
        "search",
        "Find on canvas",
        () => {
          this.dialog = "search";
          this.menuOpen = false;
        },
        "Ctrl+F",
      )}
      ${item(
        "help",
        "Help",
        () => {
          this.dialog = "help";
          this.menuOpen = false;
        },
        "?",
      )}
      ${item("delete", "Reset the canvas", this.confirmReset)}
      <span class="dropdown-separator"></span>
      <button
        class="dropdown-menu__item preferences-trigger"
        role="menuitem"
        aria-expanded=${this.preferencesOpen}
        @click=${() => (this.preferencesOpen = !this.preferencesOpen)}
      >
        <span class="dropdown-menu__icon">${icon("preferences")}</span
        ><span>Preferences</span
        ><span
          class=${`preferences-chevron ${this.preferencesOpen ? "open" : ""}`}
          >${icon("chevron")}</span
        >
      </button>
      ${this.preferencesOpen
        ? html`<div class="preference-options">
            <button
              role="menuitemcheckbox"
              aria-checked=${this.gridModeEnabled}
              @click=${() => (this.gridModeEnabled = !this.gridModeEnabled)}
            >
              <span>Grid mode</span
              ><span>${this.gridModeEnabled ? "✓" : ""}</span>
            </button>
            <button
              role="menuitemcheckbox"
              aria-checked=${this.snapToObjects}
              @click=${() => (this.snapToObjects = !this.snapToObjects)}
            >
              <span>Snap to objects</span
              ><span>${this.snapToObjects ? "✓" : ""}</span>
            </button>
          </div>`
        : nothing}
      <div class="menu-setting theme-setting">
        <span>Theme</span
        ><span class="theme-options">
          ${(["light", "dark", "auto"] as const).map(
            (theme) =>
              html`<button
                class=${this.theme === theme ? "selected" : ""}
                title=${theme === "auto"
                  ? "System theme"
                  : `${theme[0].toUpperCase()}${theme.slice(1)} theme`}
                aria-label=${theme}
                aria-pressed=${this.theme === theme}
                @click=${() => this.setTheme(theme)}
              >
                ${icon(
                  theme === "light"
                    ? "sun"
                    : theme === "dark"
                      ? "moon"
                      : "monitor",
                )}
              </button>`,
          )}
        </span>
      </div>
      <div class="menu-setting canvas-background">
        <span>Canvas background</span
        ><span class="canvas-background__colors">
          ${colors.map(
            (color) =>
              html`<button
                class=${selectedCanvasColor === color ? "selected" : ""}
                style=${`--canvas-swatch:${color}`}
                title=${color}
                aria-label=${`Canvas background ${color}`}
                @click=${() => this.setCanvasColor(color)}
              ></button>`,
          )}
          <input
            type="color"
            .value=${selectedCanvasColor}
            aria-label="Custom canvas background"
            @input=${this.onCanvasColor}
          />
        </span>
      </div>
    </div>`;
  }

  private renderMoreTools() {
    const item = (tool: Tool, label: string, shortcut = "") =>
      html` <button
        role="menuitem"
        @click=${() => {
          this.setTool(tool);
          this.moreToolsOpen = false;
        }}
      >
        ${icon(tool)}<span>${label}</span>${shortcut
          ? html`<kbd>${shortcut}</kbd>`
          : nothing}
      </button>`;
    return html` <div class="Island extra-tools-menu" role="menu">
      <button
        role="menuitem"
        @click=${() => {
          this.querySelector<HTMLInputElement>(".image-input")?.click();
          this.moreToolsOpen = false;
        }}
      >
        ${icon("image")}<span>Insert image</span><kbd>9</kbd>
      </button>
      ${item("frame", "Frame tool", "F")} ${item("embeddable", "Web Embed")}
      ${item("stickynote", "Sticky note", "N")}
      ${item("laser", "Laser pointer", "K")}
    </div>`;
  }

  private renderWelcome() {
    return html` <div class="welcome-screen-center">
        <div class="welcome-screen-center__logo">
          <span class="welcome-logo-mark">${logoIcon}</span
          ><strong>Webdraw</strong>
        </div>
        <div class="welcome-screen-center__heading">Sketch. Think. Share.</div>
        <div class="welcome-screen-menu">
          <button
            class="welcome-screen-menu-item"
            @click=${() =>
              this.querySelector<HTMLInputElement>(".scene-input")?.click()}
          >
            <span>↥</span><span>Open</span><kbd>Ctrl+O</kbd>
          </button>
          <button
            class="welcome-screen-menu-item"
            @click=${() => (this.dialog = "help")}
          >
            ${icon("help")}<span>Help</span><kbd>?</kbd>
          </button>
        </div>
      </div>
      <div
        class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu"
      >
        ↖ <span>Export, preferences, and more...</span>
      </div>
      <div
        class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar"
      >
        <span>Pick a tool &amp; Start drawing!</span> ↑
      </div>
      <div
        class="welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help"
      >
        <span>Shortcuts &amp; help</span> ↘
      </div>`;
  }

  private renderDialog() {
    const close = () => (this.dialog = null);
    if (this.dialog === "export")
      return html` <div
        class="Modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div class="Modal__background" @click=${close}></div>
        <div class="Modal__content ImageExportModal">
          <header>
            <h2 id="export-title">Export image</h2>
            <button class="modal-close" @click=${close} aria-label="Close">
              ${icon("close")}
            </button>
          </header>
          <div class="export-preview">
            <canvas aria-label="Export preview"></canvas>
          </div>
          <div class="export-settings">
            <label
              ><span>Background</span
              ><input
                type="checkbox"
                .checked=${this.exportBackground}
                @change=${(event: Event) => {
                  this.exportBackground = (
                    event.target as HTMLInputElement
                  ).checked;
                  this.requestUpdate();
                }}
            /></label>
            ${this.selectedIds.size
              ? html`<label
                  ><span>Only selected</span
                  ><input
                    type="checkbox"
                    .checked=${this.exportSelectionOnly}
                    @change=${(event: Event) => {
                      this.exportSelectionOnly = (
                        event.target as HTMLInputElement
                      ).checked;
                      this.requestUpdate();
                    }}
                /></label>`
              : nothing}
            <label
              ><span>Dark mode</span
              ><input
                type="checkbox"
                .checked=${this.exportDarkMode}
                @change=${(event: Event) => {
                  this.exportDarkMode = (
                    event.target as HTMLInputElement
                  ).checked;
                  this.requestUpdate();
                }}
            /></label>
            <label
              ><span>Embed scene</span
              ><input
                type="checkbox"
                .checked=${this.exportEmbedScene}
                @change=${(event: Event) =>
                  (this.exportEmbedScene = (
                    event.target as HTMLInputElement
                  ).checked)}
            /></label>
            <label
              ><span>Scale</span
              ><span class="segmented"
                >${[1, 2, 3].map(
                  (scale) =>
                    html`<button
                      class=${this.exportScale === scale ? "selected" : ""}
                      @click=${() => {
                        this.exportScale = scale;
                        this.requestUpdate();
                      }}
                    >
                      ${scale}×
                    </button>`,
                )}</span
              ></label
            >
            <label
              ><span>Padding</span
              ><input
                class="export-padding"
                type="number"
                min="0"
                max="100"
                .value=${String(this.exportPadding)}
                @change=${(event: Event) => {
                  this.exportPadding = Math.max(
                    0,
                    Number((event.target as HTMLInputElement).value),
                  );
                  this.requestUpdate();
                }}
            /></label>
          </div>
          <div class="export-actions">
            <button title="Export to PNG" @click=${this.exportPng}>PNG</button>
            <button title="Export to SVG" @click=${this.exportSvg}>SVG</button>
            <button title="Copy PNG to clipboard" @click=${this.copyPng}>
              Copy to clipboard
            </button>
          </div>
        </div>
      </div>`;
    if (this.dialog === "search") {
      const query = this.searchQuery.trim().toLowerCase();
      const results = this.elements.filter(
        (item) =>
          (item.type === "text" &&
            String((item as MutableElement).text)
              .toLowerCase()
              .includes(query)) ||
          (item.type === "frame" &&
            String((item as MutableElement).name ?? "Frame")
              .toLowerCase()
              .includes(query)),
      );
      return html` <div
        class="search-menu Island"
        role="dialog"
        aria-label="Find on canvas"
      >
        ${icon("search")}<input
          type="search"
          autofocus
          placeholder="Find text on canvas..."
          .value=${this.searchQuery}
          @input=${(event: InputEvent) =>
            (this.searchQuery = (event.target as HTMLInputElement).value)}
        />
        <button aria-label="Close" @click=${close}>${icon("close")}</button>
        ${query
          ? html`<div class="search-results">
              ${results.length
                ? results.map(
                    (item) =>
                      html`<button @click=${() => this.focusElement(item)}>
                        <span>${item.type === "frame" ? "Frame" : "Text"}</span
                        ><strong
                          >${item.type === "frame"
                            ? ((item as MutableElement).name ?? "Frame")
                            : (item as MutableElement).text}</strong
                        >
                      </button>`,
                  )
                : html`<p>No matches found...</p>`}
            </div>`
          : nothing}
      </div>`;
    }
    if (this.dialog === "commands") {
      const run = (action: () => void) => {
        this.dialog = null;
        this.searchQuery = "";
        action();
      };
      const commands = [
        ["Export image", () => (this.dialog = "export")],
        ["Find on canvas", () => (this.dialog = "search")],
        ["Toggle grid", () => (this.gridModeEnabled = !this.gridModeEnabled)],
        ["Toggle zen mode", () => (this.zenModeEnabled = !this.zenModeEnabled)],
        ["Toggle light/dark theme", this.toggleTheme],
        ["Zoom to fit all elements", () => this.fitElements(this.elements)],
        ["Reset zoom", () => this.setZoom(1)],
        ["Reset the canvas", this.confirmReset],
      ] as const;
      const query = this.searchQuery.toLowerCase();
      return html`<div
        class="command-menu Island"
        role="dialog"
        aria-label="Command palette"
      >
        ${icon("search")}<input
          type="search"
          placeholder="Search commands..."
          .value=${this.searchQuery}
          @input=${(event: InputEvent) =>
            (this.searchQuery = (event.target as HTMLInputElement).value)}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === "Escape") this.dialog = null;
          }}
        />
        <button class="command-close" aria-label="Close" @click=${close}>
          ${icon("close")}
        </button>
        <div class="command-results">
          ${commands
            .filter(([label]) => label.toLowerCase().includes(query))
            .map(([label, action]) => {
              const shortcut = shortcutFor(
                label === "Toggle zen mode" ? "Zen mode" : label,
              );
              return html`<button @click=${() => run(action)}>
                <span>${label}</span>${shortcut
                  ? html`<kbd>${shortcut}</kbd>`
                  : nothing}
              </button>`;
            })}
        </div>
      </div>`;
    }
    return html` <div
      class="Modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div class="Modal__background" @click=${close}></div>
      <div class="Modal__content help-dialog">
        <header>
          <h2 id="help-title">Help</h2>
          <button class="modal-close" @click=${close} aria-label="Close">
            ${icon("close")}
          </button>
        </header>
        <div class="help-shortcuts">
          ${SHORTCUT_GROUPS.map(
            (group) =>
              html` <section class="shortcut-section">
                <h3>${group.title}</h3>
                <div class="shortcut-grid">
                  ${group.items.map(
                    (item) => html`
                      <span class="shortcut-label">${item.label}</span>
                      <span class="shortcut-bindings"
                        >${item.bindings.map(
                          (binding, index) =>
                            html`${index
                                ? html`<small>or</small>`
                                : nothing}<span class="shortcut-binding"
                                >${binding.map(
                                  (key) => html`<kbd>${key}</kbd>`,
                                )}</span
                              >`,
                        )}</span
                      >
                    `,
                  )}
                </div>
              </section>`,
          )}
        </div>
      </div>
    </div>`;
  }

  private renderContextMenu() {
    const grouped = this.elements.some(
      (item) => this.selectedIds.has(item.id) && item.groupIds.length,
    );
    const locked = this.elements.some(
      (item) => this.selectedIds.has(item.id) && item.locked,
    );
    const action = (callback: () => void) => {
      callback();
      this.contextMenu = null;
    };
    return html` <div
      class="Island context-menu"
      role="menu"
      style=${`left:${this.contextMenu!.x}px;top:${this.contextMenu!.y}px`}
    >
      <button role="menuitem" @click=${() => action(this.copySelected)}>
        Copy <kbd>Ctrl+C</kbd>
      </button>
      <button role="menuitem" @click=${() => action(this.duplicateSelected)}>
        Duplicate <kbd>Ctrl+D</kbd>
      </button>
      <span class="dropdown-separator"></span>
      <button role="menuitem" @click=${() => action(this.sendBackward)}>
        Send backward
      </button>
      <button role="menuitem" @click=${() => action(this.bringForward)}>
        Bring forward
      </button>
      ${this.selectedIds.size > 1 || grouped
        ? html`<button
            role="menuitem"
            @click=${() =>
              action(grouped ? this.ungroupSelected : this.groupSelected)}
          >
            ${grouped ? "Ungroup selection" : "Group selection"}
          </button>`
        : nothing}
      <button role="menuitem" @click=${() => action(this.setSelectedLink)}>
        Add link
      </button>
      <button
        role="menuitem"
        @click=${() => action(() => this.updateSelected({ locked: !locked }))}
      >
        ${locked ? "Unlock" : "Lock"}
      </button>
      <span class="dropdown-separator"></span>
      <button
        class="danger"
        role="menuitem"
        @click=${() => action(() => this.deleteSelected())}
      >
        Delete <kbd>Delete</kbd>
      </button>
    </div>`;
  }

  private renderProperties() {
    if (
      this.viewModeEnabled ||
      (this.tool === "selection" && !this.selectedIds.size) ||
      this.tool === "hand" ||
      this.tool === "eraser"
    )
      return nothing;
    const selected = this.elements.find((item) =>
      this.selectedIds.has(item.id),
    ) as MutableElement | undefined;
    const sticky =
      selected?.type === "stickynote" || this.tool === "stickynote";
    const textOnly = selected?.type === "text" || this.tool === "text";
    const text =
      textOnly || sticky || !!(selected && this.boundLabel(selected));
    const linear = selected?.type === "arrow" || this.tool === "arrow";
    const edgeTargets = this.elements.filter(
      (item) => this.selectedIds.has(item.id) && canChangeRoundness(item.type),
    );
    const edgeValue = edgeTargets.length
      ? edgeTargets.every((item) => !!item.roundness)
        ? true
        : edgeTargets.every((item) => !item.roundness)
          ? false
          : null
      : this.edgeRound;
    const locked = this.elements.some(
      (item) => this.selectedIds.has(item.id) && item.locked,
    );
    const palette = (
      colors: readonly string[],
      current: string,
      set: (color: string) => void,
      allowTransparent = false,
    ) =>
      html` <span class="color-palette">
        ${allowTransparent
          ? html`<button
              class="color-swatch transparent ${current === "transparent"
                ? "selected"
                : ""}"
              title="Transparent"
              aria-label="Transparent"
              @click=${() => set("transparent")}
            >
              ×
            </button>`
          : nothing}
        ${colors
          .filter((color) => color !== "transparent")
          .map(
            (color) =>
              html`<button
                class="color-swatch ${current === color ? "selected" : ""}"
                style=${`--swatch:${applyDarkModeFilter(color, this.isDarkTheme())}`}
                title=${color}
                aria-label=${color}
                @click=${() => set(color)}
              ></button>`,
          )}
        <input
          class="color-swatch custom-color"
          type="color"
          .value=${current === "transparent" ? "#ffffff" : current}
          aria-label="Custom color"
          @input=${(event: InputEvent) =>
            set((event.target as HTMLInputElement).value)}
        />
      </span>`;
    return html` <div class="Island selected-shape-actions">
      <label
        >${sticky ? "Text color" : "Stroke"}${palette(
          DEFAULT_ELEMENT_STROKE_PICKS,
          this.strokeColor,
          this.setStrokeColor,
        )}</label
      >
      ${textOnly
        ? nothing
        : html`<label
            >Background${palette(
              sticky
                ? STICKY_NOTE_BACKGROUND_PICKS
                : DEFAULT_ELEMENT_BACKGROUND_PICKS,
              this.backgroundColor,
              this.setBackground,
              !sticky,
            )}</label
          >`}
      ${textOnly || sticky || linear
        ? nothing
        : html` <label
            >Fill
            <span class="segmented wide"
              >${(["hachure", "cross-hatch", "solid"] as const).map(
                (style) =>
                  html`<button
                    title=${style}
                    class=${this.fillStyle === style ? "selected" : ""}
                    @click=${() => this.setFillStyle(style)}
                  >
                    ${style === "hachure"
                      ? "╱"
                      : style === "cross-hatch"
                        ? "╳"
                        : "■"}
                  </button>`,
              )}</span
            ></label
          >`}
      ${textOnly || sticky
        ? nothing
        : html` <label
              >Stroke width
              <span class="segmented"
                >${[1, 2, 4].map(
                  (width) =>
                    html`<button
                      class=${this.strokeWidth === width ? "selected" : ""}
                      @click=${() => this.setStrokeWidth(width)}
                      aria-label=${`Stroke width ${width}`}
                    >
                      <span class=${`stroke-width-${width}`}></span>
                    </button>`,
                )}</span
              ></label
            >
            <label
              >Stroke style
              <span class="segmented wide"
                >${(["solid", "dashed", "dotted"] as const).map(
                  (style) =>
                    html`<button
                      title=${style}
                      class=${this.strokeStyle === style ? "selected" : ""}
                      @click=${() => this.setStrokeStyle(style)}
                    >
                      ${style === "solid"
                        ? "━"
                        : style === "dashed"
                          ? "┅"
                          : "┈"}
                    </button>`,
                )}</span
              ></label
            >`}
      ${textOnly
        ? nothing
        : html`<label
            >Sloppiness
            <span class="segmented"
              >${[0, 1, 2].map(
                (value) =>
                  html`<button
                    title=${["Architect", "Artist", "Cartoonist"][value]}
                    aria-label=${`Sloppiness ${value + 1}`}
                    class=${this.roughness === value ? "selected" : ""}
                    @click=${() => this.setRoughness(value)}
                  >
                    ${sloppinessIcon(value)}
                  </button>`,
              )}</span
            ></label
          >`}
      ${canChangeRoundness(this.tool as never) || edgeTargets.length
        ? html`<label
            >Edges
            <span class="segmented"
              >${[false, true].map(
                (round) =>
                  html`<button
                    class=${edgeValue === round ? "selected" : ""}
                    title=${round ? "Round" : "Sharp"}
                    aria-label=${`${round ? "Round" : "Sharp"} edges`}
                    @click=${() => this.setEdges(round)}
                  >
                    ${edgeIcon(round)}
                  </button>`,
              )}</span
            ></label
          >`
        : nothing}
      ${linear
        ? html` <label
              >Arrow type
              <span class="segmented"
                >${(["sharp", "round", "elbow"] as const).map(
                  (type) =>
                    html`<button
                      class=${this.arrowType === type ? "selected" : ""}
                      title=${type}
                      @click=${() => this.setArrowType(type)}
                    >
                      ${type === "sharp" ? "↗" : type === "round" ? "↷" : "↱"}
                    </button>`,
                )}</span
              ></label
            >
            <label
              >Arrowheads
              <span class="arrowheads-row"
                ><span class="segmented"
                  >${([null, "arrow", "bar"] as Arrowhead[]).map(
                    (head) =>
                      html`<button
                        class=${this.startArrowhead === head ? "selected" : ""}
                        title=${`Start ${head ?? "none"}`}
                        @click=${() => this.setArrowhead("start", head)}
                      >
                        ${head === null ? "×–" : head === "bar" ? "|–" : "←"}
                      </button>`,
                  )}</span
                ><span class="segmented"
                  >${(
                    [
                      null,
                      "arrow",
                      "triangle",
                      "circle",
                      "diamond",
                      "bar",
                    ] as Arrowhead[]
                  ).map(
                    (head) =>
                      html`<button
                        class=${this.endArrowhead === head ? "selected" : ""}
                        title=${`End ${head ?? "none"}`}
                        @click=${() => this.setArrowhead("end", head)}
                      >
                        ${head === null
                          ? "–×"
                          : head === "triangle"
                            ? "▷"
                            : head === "circle"
                              ? "–○"
                              : head === "diamond"
                                ? "–◇"
                                : head === "bar"
                                  ? "–|"
                                  : "→"}
                      </button>`,
                  )}</span
                ></span
              ></label
            >`
        : nothing}
      ${text
        ? html` <label
              >Font family
              <span class="segmented font-family"
                >${(
                  [
                    [FONT_FAMILY.Excalifont, "✎", "Hand-drawn"],
                    [FONT_FAMILY.Nunito, "A", "Normal"],
                    [FONT_FAMILY["Comic Shanns"], "‹/›", "Code"],
                    [FONT_FAMILY.Cascadia, "A", "Cascadia"],
                    [FONT_FAMILY["Lilita One"], "L", "Lilita One"],
                  ] as const
                ).map(
                  ([family, mark, title]) =>
                    html`<button
                      class=${this.fontFamily === family ? "selected" : ""}
                      title=${title}
                      @click=${() => this.setFontFamily(family)}
                    >
                      ${mark}
                    </button>`,
                )}</span
              ></label
            >
            <label
              >Font size
              <span class="segmented font-size"
                >${(
                  [
                    [16, "S"],
                    [20, "M"],
                    [28, "L"],
                    [36, "XL"],
                  ] as const
                ).map(
                  ([size, label]) =>
                    html`<button
                      class=${this.fontSize === size ? "selected" : ""}
                      @click=${() => this.setFontSize(size)}
                    >
                      ${label}
                    </button>`,
                )}</span
              ></label
            >
            <label
              >Text align
              <span class="segmented"
                >${(["left", "center", "right"] as const).map(
                  (align) =>
                    html`<button
                      class="text-${align} ${this.textAlign === align
                        ? "selected"
                        : ""}"
                      title=${align}
                      @click=${() => this.setTextAlign(align)}
                    >
                      ≡
                    </button>`,
                )}</span
              ></label
            >
            ${sticky
              ? html`<label
                  >Vertical align
                  <span class="segmented"
                    >${(["top", "middle", "bottom"] as const).map(
                      (align) =>
                        html`<button
                          class=${this.verticalAlign === align
                            ? "selected"
                            : ""}
                          title=${align}
                          @click=${() => this.setVerticalAlign(align)}
                        >
                          ${align === "top"
                            ? "⊤"
                            : align === "middle"
                              ? "⊢"
                              : "⊥"}
                        </button>`,
                    )}</span
                  ></label
                >`
              : nothing}`
        : nothing}
      <label
        >Opacity
        <span class="range-row"
          ><input
            type="range"
            min="0"
            max="100"
            .value=${String(this.opacity)}
            @pointerdown=${() => (this.opacityCheckpointed = false)}
            @change=${() => (this.opacityCheckpointed = false)}
            @input=${this.onOpacity}
          /><output>${this.opacity}</output></span
        ></label
      >
      ${this.selectedIds.size
        ? html` <label
              >Layers
              <span class="action-row icon-actions"
                ><button title="Send to back" @click=${this.sendToBack}>
                  ${icon("sendBack")}</button
                ><button title="Send backward" @click=${this.sendBackward}>
                  ${icon("sendBackward")}</button
                ><button title="Bring forward" @click=${this.bringForward}>
                  ${icon("bringForward")}</button
                ><button title="Bring to front" @click=${this.bringToFront}>
                  ${icon("bringFront")}
                </button></span
              ></label
            >
            <label
              >Actions
              <span class="action-row icon-actions"
                ><button title="Duplicate" @click=${this.duplicateSelected}>
                  ${icon("duplicate")}</button
                ><button
                  class="danger"
                  title="Delete"
                  @click=${this.deleteSelected}
                >
                  ${icon("delete")}</button
                ><button title="Add link" @click=${this.setSelectedLink}>
                  ${icon("link")}</button
                ><button
                  title=${locked ? "Unlock" : "Lock"}
                  @click=${() => this.updateSelected({ locked: !locked })}
                >
                  ${icon("lock")}
                </button></span
              ></label
            >`
        : nothing}
    </div>`;
  }

  private setTool(tool: Tool) {
    if (this.viewModeEnabled) return;
    if (this.pendingLinearId) this.finishPendingLinear();
    this.tool = tool;
    if (tool === "stickynote") this.backgroundColor = DEFAULT_STICKY_NOTE_BG;
    if (tool !== "selection") this.selectedIds = new Set();
    if (this.canvas) this.canvas.style.cursor = "";
    this.focus();
  }

  private finishPendingLinear = () => {
    if (!this.pendingLinearId) return;
    const id = this.pendingLinearId,
      element = this.elements.find((item) => item.id === id) as
        | MutableElement
        | undefined;
    this.pendingLinearId = null;
    if (!element) return;
    this.elements = finishLinearWithExcalidraw(
      this.elements,
      id,
    ) as WebdrawElement[];
    if (this.elements.some((item) => item.id === id)) {
      this.selectedIds = new Set([id]);
      if (element.type === "arrow" && !this.pendingLinearBindingDisabled)
        this.elements = bindArrowEndpointWithExcalidraw(
          this.elements,
          id,
          "end",
          this.zoom,
        ) as WebdrawElement[];
    }
    this.pendingLinearBindingDisabled = false;
    if (!this.toolLocked) this.tool = "selection";
    this.emitChange();
    this.requestUpdate();
  };

  private scenePoint(event: Pick<MouseEvent, "clientX" | "clientY">): Point {
    const rect = this.canvas!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.pan.x) / this.zoom,
      y: (event.clientY - rect.top - this.pan.y) / this.zoom,
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    if ((event.button !== 0 && event.button !== 1) || this.editingText) return;
    this.focus();
    this.menuOpen = false;
    this.moreToolsOpen = false;
    this.libraryOpen = false;
    this.contextMenu = null;
    this.canvas!.setPointerCapture(event.pointerId);
    const point = this.scenePoint(event);
    if (
      this.viewModeEnabled ||
      this.tool === "hand" ||
      event.button === 1 ||
      this.spacePressed
    ) {
      this.drag = {
        mode: "pan",
        start: point,
        last: { x: event.clientX, y: event.clientY },
        pan: { ...this.pan },
      };
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
    if (
      (this.tool === "line" || this.tool === "arrow") &&
      this.pendingLinearId
    ) {
      const element = this.elements.find(
        (item) => item.id === this.pendingLinearId,
      ) as MutableElement | undefined;
      if (element) {
        this.elements = moveLinearPointWithExcalidraw(
          this.elements,
          element.id,
          element.points.length - 1,
          point,
        ) as WebdrawElement[];
        this.elements = appendLinearPointWithExcalidraw(
          this.elements,
          element.id,
          point,
        ) as WebdrawElement[];
        this.drag = {
          mode: "draw",
          start: point,
          last: point,
          draftId: element.id,
          checkpointed: true,
          multiPoint: true,
          bindingDisabled: event.ctrlKey || event.metaKey,
        };
        return;
      }
      this.pendingLinearId = null;
    }
    if (this.tool === "bucket") {
      this.drag = { mode: "bucket", start: point, last: point };
      return;
    }
    if (this.tool === "selection") {
      const editedLinear = this.editingLinearId
        ? (this.elements.find((item) => item.id === this.editingLinearId) as
            | MutableElement
            | undefined)
        : undefined;
      if (editedLinear?.type === "line" || editedLinear?.type === "arrow") {
        const pointIndex = linearPointIndexAt(
          point,
          editedLinear,
          this.elements,
          this.zoom,
        );
        if (pointIndex >= 0) {
          this.checkpoint();
          this.drag = {
            mode: "point",
            start: point,
            last: point,
            element: structuredClone(editedLinear),
            pointIndex,
          };
          return;
        }
      }
      const transform = this.selectionHandleAt(point);
      if (transform) {
        const element = structuredClone(
          this.elements.find((item) => this.selectedIds.has(item.id))!,
        ) as MutableElement;
        this.checkpoint();
        this.drag = {
          mode:
            transform === "rotate"
              ? "rotate"
              : element.id === this.croppingImageId
                ? "crop"
                : "resize",
          start: point,
          last: point,
          element,
          handle: transform === "rotate" ? undefined : transform,
          originalElements: new Map(
            this.elements.map((item) => [item.id, structuredClone(item)]),
          ),
        };
        this.canvas!.style.cursor =
          transform === "rotate"
            ? "grabbing"
            : cursorForHandle(
                transform,
                this.selectedIds.size === 1 ? element.angle : 0,
              );
        return;
      }
      const hits = this.hitTestAll(point);
      const targets = hits
        .map((item) =>
          item.type === "text" && (item as MutableElement).containerId
            ? (this.elements.find(
                (candidate) =>
                  candidate.id === (item as MutableElement).containerId,
              ) ?? item)
            : item,
        )
        .filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.id === item.id) === index,
        );
      const hit =
        event.ctrlKey || event.metaKey
          ? (targets.find((item) => !this.selectedIds.has(item.id)) ??
            targets[0])
          : targets[0];
      if (hit) {
        if ((event.ctrlKey || event.metaKey) && hit.link) {
          const url = this.safeUrl(hit.link);
          if (url)
            this.ownerDocument.defaultView?.open(url, "_blank", "noopener");
          return;
        }
        if (!event.shiftKey && !this.selectedIds.has(hit.id))
          this.selectedIds = this.groupSelectionFor(hit);
        else if (event.shiftKey) {
          const next = new Set(this.selectedIds);
          if (next.has(hit.id)) next.delete(hit.id);
          else next.add(hit.id);
          this.selectedIds = next;
        }
        if ((event.ctrlKey || event.metaKey) && !hit.link) {
          this.syncStyleFromElement(hit as MutableElement);
          this.selectionRect = { start: point, end: point };
          this.drag = { mode: "select", start: point, last: point };
          return;
        }
        if (event.altKey && !event.shiftKey) this.duplicateSelected();
        if (
          [...this.selectedIds].every(
            (id) => this.elements.find((element) => element.id === id)?.locked,
          )
        )
          return;
        this.drag = {
          mode: "move",
          start: point,
          last: point,
          originalElements: new Map(
            this.elements.map((element) => [
              element.id,
              structuredClone(element),
            ]),
          ),
        };
        this.canvas!.style.cursor = "move";
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
    const base = {
      x: point.x,
      y: point.y,
      strokeColor: this.strokeColor,
      backgroundColor: this.backgroundColor,
      strokeWidth: this.strokeWidth,
      strokeStyle: this.strokeStyle,
      roughness: this.roughness,
      opacity: this.opacity,
      fillStyle: this.fillStyle,
    };
    let element: WebdrawElement;
    if (tool === "arrow") {
      element = newArrowElement({
        ...base,
        type: "arrow",
        points: [
          [0, 0],
          [0, 0],
        ] as any,
        roundness:
          this.arrowType === "round"
            ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
            : null,
        startArrowhead: this.startArrowhead,
        endArrowhead: this.endArrowhead,
        elbowed: this.arrowType === "elbow",
      }) as WebdrawElement;
    } else if (tool === "line") {
      element = newLinearElement({
        ...base,
        type: "line",
        points: [
          [0, 0],
          [0, 0],
        ] as any,
        roundness: edgeRoundness("line", this.edgeRound),
      }) as WebdrawElement;
    } else if (tool === "freedraw" || tool === "laser") {
      element = newFreeDrawElement({
        ...base,
        type: "freedraw",
        strokeColor: tool === "laser" ? "#e03131" : base.strokeColor,
        points: [[0, 0]] as any,
        simulatePressure: true,
        customData: tool === "laser" ? { webdrawLaser: true } : undefined,
      }) as WebdrawElement;
    } else if (tool === "frame") {
      element = newFrameElement({
        ...base,
        name: null as any,
      }) as WebdrawElement;
    } else if (tool === "embeddable") {
      element = newEmbeddableElement({
        ...base,
        type: "embeddable",
        roundness: edgeRoundness("embeddable", this.edgeRound),
      }) as WebdrawElement;
    } else if (tool === "stickynote") {
      element = newStickyNoteElement({
        ...base,
        type: "stickynote",
        backgroundColor:
          this.backgroundColor === "transparent"
            ? DEFAULT_STICKY_NOTE_BG
            : this.backgroundColor,
        fillStyle: "solid",
        roundness: edgeRoundness("stickynote", this.edgeRound),
      }) as WebdrawElement;
    } else {
      element = newElement({
        ...base,
        type: tool as "rectangle" | "diamond" | "ellipse",
        roundness:
          tool === "ellipse" ? null : edgeRoundness(tool, this.edgeRound),
      }) as WebdrawElement;
    }
    this.elements = [...this.elements, element];
    const bindingDisabled = event.ctrlKey || event.metaKey;
    if (element.type === "arrow" && !bindingDisabled)
      this.elements = bindArrowEndpointWithExcalidraw(
        this.elements,
        element.id,
        "start",
        this.zoom,
        true,
      ) as WebdrawElement[];
    this.drag = {
      mode: "draw",
      start: point,
      last: point,
      draftId: element.id,
      checkpointed: true,
      bindingDisabled,
    };
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag) {
      if (this.pendingLinearId) {
        const element = this.elements.find(
          (item) => item.id === this.pendingLinearId,
        ) as MutableElement | undefined;
        if (element) {
          this.elements = moveLinearPointWithExcalidraw(
            this.elements,
            element.id,
            element.points.length - 1,
            this.scenePoint(event),
          ) as WebdrawElement[];
          this.paint();
          return;
        }
      }
      this.canvas!.style.cursor = this.cursorAt(this.scenePoint(event));
      return;
    }
    if (this.drag.mode === "pan") {
      this.pan = {
        x: this.drag.pan!.x + event.clientX - this.drag.last.x,
        y: this.drag.pan!.y + event.clientY - this.drag.last.y,
      };
      this.requestUpdate();
      return;
    }
    const point = this.scenePoint(event);
    this.drag.last = point;
    if (this.drag.mode === "erase") {
      this.eraseAt(point);
      return;
    }
    if (this.drag.mode === "bucket") return;
    if (this.drag.mode === "select") {
      if (
        Math.hypot(point.x - this.drag.start.x, point.y - this.drag.start.y) <
        2 / this.zoom
      )
        return;
      this.selectionRect = { start: this.drag.start, end: point };
      this.selectWithin(this.selectionRect);
      this.paint();
      return;
    }
    if (this.drag.mode === "rotate") {
      this.elements = transformElementsWithExcalidraw({
        elements: this.elements,
        selectedIds: this.selectedIds,
        originals: this.drag.originalElements!,
        handle: "rotate",
        point,
        maintainAspectRatio: event.shiftKey,
        resizeFromCenter: event.altKey,
      }) as WebdrawElement[];
      return;
    }
    if (this.drag.mode === "resize") {
      this.elements = transformElementsWithExcalidraw({
        elements: this.elements,
        selectedIds: this.selectedIds,
        originals: this.drag.originalElements!,
        handle: this.drag.handle!,
        point,
        maintainAspectRatio: event.shiftKey,
        resizeFromCenter: event.altKey,
      }) as WebdrawElement[];
      return;
    }
    if (this.drag.mode === "crop") {
      const original = this.drag.element!;
      if (original.type !== "image" || !original.fileId) return;
      const cached = this.imageCache.get(original.fileId as never)?.image;
      if (!cached || cached instanceof Promise) return;
      this.elements = cropImageWithExcalidraw({
        elements: this.elements,
        original,
        handle: this.drag.handle!,
        point,
        naturalWidth: cached.naturalWidth,
        naturalHeight: cached.naturalHeight,
      }) as WebdrawElement[];
      return;
    }
    if (this.drag.mode === "point") {
      this.elements = moveLinearPointWithExcalidraw(
        this.elements,
        this.drag.element!.id,
        this.drag.pointIndex!,
        point,
      ) as WebdrawElement[];
      return;
    }
    if (this.drag.mode === "move") {
      if (!this.drag.checkpointed) {
        this.checkpoint();
        this.drag.checkpointed = true;
      }
      let dx = point.x - this.drag.start.x,
        dy = point.y - this.drag.start.y;
      if (this.snapToObjects)
        ({ x: dx, y: dy } = this.snappedDelta(this.movingElementIds(), dx, dy));
      this.elements = dragElementsWithExcalidraw({
        elements: this.elements,
        selectedIds: this.selectedIds,
        originals: this.drag.originalElements!,
        offset: { x: dx, y: dy },
      }) as WebdrawElement[];
      return;
    }
    const draft = this.elements.find(
      (element) => element.id === this.drag!.draftId,
    ) as MutableElement | undefined;
    if (!draft) return;
    if (draft.type === "freedraw") {
      this.elements = extendFreeDrawWithExcalidraw(
        this.elements,
        draft.id,
        point,
      ) as WebdrawElement[];
    } else if (draft.type === "line" || draft.type === "arrow") {
      this.elements = moveLinearPointWithExcalidraw(
        this.elements,
        draft.id,
        draft.points.length - 1,
        point,
      ) as WebdrawElement[];
    } else {
      this.elements = dragNewShapeWithExcalidraw({
        elements: this.elements,
        elementId: draft.id,
        origin: this.drag.start,
        point,
        maintainAspectRatio: event.shiftKey,
        resizeFromCenter: event.altKey,
        zoom: this.zoom,
      }) as WebdrawElement[];
    }
  };

  private onPointerUp = (event?: PointerEvent) => {
    if (!this.drag) return;
    if (
      this.viewModeEnabled &&
      this.drag.mode === "pan" &&
      event &&
      Math.hypot(
        event.clientX - this.drag.last.x,
        event.clientY - this.drag.last.y,
      ) < 3
    ) {
      const hit = this.hitTest(this.scenePoint(event));
      const url = hit?.link ? this.safeUrl(hit.link) : null;
      if (url) this.ownerDocument.defaultView?.open(url, "_blank", "noopener");
    }
    const bindingDisabled = this.drag.bindingDisabled;
    let bucketFilled = false;
    if (this.drag.mode === "bucket" && event?.type !== "pointercancel") {
      const filled = fillRegionWithExcalidraw({
        elements: this.elements,
        point: this.drag.start,
        backgroundColor:
          this.backgroundColor === "transparent"
            ? COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX]
            : this.backgroundColor,
        fillStyle: this.fillStyle,
        opacity: this.opacity,
      });
      if (filled) {
        this.checkpoint();
        this.elements = filled as WebdrawElement[];
        bucketFilled = true;
      }
    }
    const moved =
      Math.hypot(
        this.drag.last.x - this.drag.start.x,
        this.drag.last.y - this.drag.start.y,
      ) >
      2 / this.zoom;
    let changed =
      this.drag.mode === "draw" ||
      this.drag.mode === "erase" ||
      bucketFilled ||
      ((this.drag.mode === "move" ||
        this.drag.mode === "resize" ||
        this.drag.mode === "rotate" ||
        this.drag.mode === "point" ||
        this.drag.mode === "crop") &&
        moved);
    if (this.drag.mode === "draw") {
      let element = this.elements.find(
        (item) => item.id === this.drag!.draftId,
      );
      const laser = !!(element as MutableElement | undefined)?.customData
        ?.webdrawLaser;
      const linearClick =
        !!element &&
        (element.type === "line" || element.type === "arrow") &&
        this.isTiny(element);
      if (this.drag.multiPoint) {
        this.pendingLinearId = element?.id ?? null;
        this.pendingLinearBindingDisabled = !!bindingDisabled;
        this.selectedIds = new Set();
      } else if (linearClick) {
        this.pendingLinearId = element!.id;
        this.pendingLinearBindingDisabled = !!bindingDisabled;
        this.selectedIds = new Set();
      } else if (element?.type === "stickynote") {
        const size = this.isTiny(element)
          ? { width: 250, height: 250 }
          : { width: element.width, height: element.height };
        element = normalizeStickyNote({
          ...element,
          ...size,
          baseHeight: size.height,
        } as Extract<WebdrawElement, { type: "stickynote" }>) as WebdrawElement;
        this.replaceElement(element);
      } else if (element && this.isTiny(element)) {
        const id = element.id;
        this.elements = this.elements.filter((item) => item.id !== id);
      } else if (element && !laser) this.selectedIds = new Set([element.id]);
      if (
        element?.type === "arrow" &&
        !this.pendingLinearId &&
        !bindingDisabled
      )
        this.elements = bindArrowEndpointWithExcalidraw(
          this.elements,
          element.id,
          "end",
          this.zoom,
        ) as WebdrawElement[];
      if (element?.type === "embeddable") {
        const url = this.ownerDocument.defaultView?.prompt(
          "Paste a URL to embed",
          "https://",
        );
        if (url)
          this.replaceElement({
            ...element,
            link: url,
            customData: { ...(element.customData ?? {}), embedUrl: url },
          } as WebdrawElement);
      }
      if (element?.type === "frame") {
        this.elements = addChildrenToNewFrameWithExcalidraw(
          this.elements,
          element.id,
        ) as WebdrawElement[];
      }
      if (laser) {
        changed = false;
        const id = element!.id;
        this.ownerDocument.defaultView?.setTimeout(() => {
          this.elements = this.elements.filter((item) => item.id !== id);
          this.requestUpdate();
        }, 650);
      }
      if (
        element?.type === "stickynote" &&
        this.elements.some((item) => item.id === element!.id)
      ) {
        this.startTextEditing(
          { x: element!.x, y: element!.y },
          undefined,
          element!.id,
        );
      }
      if (
        !this.pendingLinearId &&
        !this.toolLocked &&
        this.tool !== "freedraw" &&
        this.tool !== "laser"
      )
        this.tool = "selection";
    }
    if (moved && (this.drag.mode === "move" || this.drag.mode === "resize")) {
      this.elements = reconcileFrameMembershipWithExcalidraw(
        this.elements,
        this.selectedIds,
        this.drag.last,
        this.drag.mode,
      ) as WebdrawElement[];
    }
    this.drag = null;
    this.selectionRect = null;
    if (this.canvas)
      this.canvas.style.cursor =
        event && event.type !== "pointercancel"
          ? this.cursorAt(this.scenePoint(event))
          : "";
    if (changed) this.emitChange();
    this.requestUpdate();
  };

  private onPointerLeave = () => {
    if (!this.drag && this.canvas) this.canvas.style.cursor = "";
  };

  private onDoubleClick = (event: MouseEvent) => {
    if (this.viewModeEnabled) return;
    event.preventDefault();
    if (this.pendingLinearId) {
      this.finishPendingLinear();
      return;
    }
    const point = this.scenePoint(event as unknown as PointerEvent);
    const hit = this.hitTest(point);
    if (hit?.type === "text")
      this.startTextEditing(point, hit as MutableElement);
    else if (hit?.type === "image") {
      this.selectedIds = new Set([hit.id]);
      this.croppingImageId = hit.id;
    } else if (hit?.type === "line" || hit?.type === "arrow") {
      this.selectedIds = new Set([hit.id]);
      this.editingLinearId = hit.id;
    } else if (hit && !["freedraw", "image", "frame"].includes(hit.type)) {
      const labelId = hit.boundElements?.find(
        (binding) => binding.type === "text",
      )?.id;
      const label = labelId
        ? (this.elements.find((item) => item.id === labelId) as
            | MutableElement
            | undefined)
        : undefined;
      if (label) this.startTextEditing(point, label);
      else this.startTextEditing(point, undefined, hit.id);
    } else if (!hit) this.startTextEditing(point);
  };

  private onContextMenu = (event: MouseEvent) => {
    if (this.viewModeEnabled) return;
    event.preventDefault();
    const hit = this.hitTest(this.scenePoint(event));
    if (hit && !this.selectedIds.has(hit.id))
      this.selectedIds = this.groupSelectionFor(hit);
    if (!this.selectedIds.size) return;
    const rect = this.getBoundingClientRect();
    this.contextMenu = {
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 240)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 300)),
    };
    this.menuOpen = false;
    this.moreToolsOpen = false;
    this.libraryOpen = false;
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = this.canvas!.getBoundingClientRect();
      const before = {
        x: (event.clientX - rect.left - this.pan.x) / this.zoom,
        y: (event.clientY - rect.top - this.pan.y) / this.zoom,
      };
      const zoom = Math.min(
        30,
        Math.max(0.1, this.zoom * Math.exp(-event.deltaY / 300)),
      );
      this.pan = {
        x: event.clientX - rect.left - before.x * zoom,
        y: event.clientY - rect.top - before.y * zoom,
      };
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
    const run = (action: () => void) => {
      event.preventDefault();
      action();
    };
    if (event.code === "Space") {
      event.preventDefault();
      this.spacePressed = true;
      return;
    }
    if (this.pendingLinearId && event.key === "Enter") {
      run(this.finishPendingLinear);
      return;
    }
    if (this.pendingLinearId && event.key === "Escape") {
      run(this.finishPendingLinear);
      return;
    }
    if (
      this.croppingImageId &&
      (event.key === "Enter" || event.key === "Escape")
    ) {
      run(() => (this.croppingImageId = null));
      return;
    }
    if (primary && event.key === "Enter" && this.selectedIds.size === 1) {
      const selected = this.elements.find((item) =>
        this.selectedIds.has(item.id),
      );
      if (selected?.type === "line" || selected?.type === "arrow") {
        run(() => (this.editingLinearId = selected.id));
        return;
      }
    }
    if (primary && event.key === "Delete") {
      run(this.confirmReset);
      return;
    }
    if (primary && event.altKey && key === "c") {
      run(this.copyStyles);
      return;
    }
    if (primary && event.altKey && key === "v") {
      run(this.pasteStyles);
      return;
    }
    if (primary && event.shiftKey && event.code === "BracketLeft") {
      run(this.sendToBack);
      return;
    }
    if (primary && event.shiftKey && event.code === "BracketRight") {
      run(this.bringToFront);
      return;
    }
    if (primary && event.code === "BracketLeft") {
      run(this.sendBackward);
      return;
    }
    if (primary && event.code === "BracketRight") {
      run(this.bringForward);
      return;
    }
    if (
      primary &&
      event.shiftKey &&
      event.key.startsWith("Arrow") &&
      this.selectedIds.size
    ) {
      run(() => this.alignSelected(event.key));
      return;
    }
    if (
      primary &&
      event.key.startsWith("Arrow") &&
      this.selectedIds.size === 1
    ) {
      run(() => this.createFlowchartNode(event.key));
      return;
    }
    if (primary && event.shiftKey && key === "l") {
      run(this.toggleSelectedLock);
      return;
    }
    if (primary && event.shiftKey && (event.key === "<" || event.key === ">")) {
      run(() => this.changeFontSize(event.key === ">" ? 4 : -4));
      return;
    }
    if (primary && (event.key === "+" || event.key === "=")) {
      run(() => this.setZoom(this.zoom + 0.1));
      return;
    }
    if (primary && event.key === "-") {
      run(() => this.setZoom(this.zoom - 0.1));
      return;
    }
    if (primary && key === "0") {
      run(() => this.setZoom(1));
      return;
    }
    if (primary && event.key === "'") {
      run(() => (this.gridModeEnabled = !this.gridModeEnabled));
      return;
    }
    if (primary && key === "k") {
      run(this.setSelectedLink);
      return;
    }
    if (primary && key === "f") {
      run(() => (this.dialog = "search"));
      return;
    }
    if (primary && key === "/") {
      run(() => {
        this.searchQuery = "";
        this.dialog = "commands";
      });
      return;
    }
    if (primary && event.shiftKey && key === "e") {
      run(() => (this.dialog = "export"));
      return;
    }
    if (primary && key === "o") {
      run(() => this.querySelector<HTMLInputElement>(".scene-input")?.click());
      return;
    }
    if (primary && key === "a") {
      run(
        () =>
          (this.selectedIds = new Set(
            this.elements
              .filter((item) => !(item as MutableElement).containerId)
              .map((item) => item.id),
          )),
      );
      return;
    }
    if (primary && key === "c" && this.selectedIds.size) {
      run(this.copySelected);
      return;
    }
    if (primary && key === "x" && this.selectedIds.size) {
      run(() => {
        this.copySelected();
        this.deleteSelected();
      });
      return;
    }
    if (primary && event.shiftKey && key === "v") {
      run(this.pastePlaintext);
      return;
    }
    if (primary && key === "v") {
      run(() => void this.pasteClipboard());
      return;
    }
    if (primary && key === "d" && this.selectedIds.size) {
      run(this.duplicateSelected);
      return;
    }
    if (primary && key === "g" && this.selectedIds.size) {
      run(event.shiftKey ? this.ungroupSelected : this.groupSelected);
      return;
    }
    if (primary && key === "z") {
      run(event.shiftKey ? this.redo : this.undo);
      return;
    }
    if (primary && key === "y") {
      run(this.redo);
      return;
    }
    if (event.altKey && event.shiftKey && key === "d") {
      run(this.toggleTheme);
      return;
    }
    if (event.altKey && key === "z") {
      run(() => (this.zenModeEnabled = !this.zenModeEnabled));
      return;
    }
    if (event.altKey && key === "r") {
      run(() => (this.viewModeEnabled = !this.viewModeEnabled));
      return;
    }
    if (event.altKey && event.key.startsWith("Arrow")) {
      run(() => this.navigateFlowchart(event.key));
      return;
    }
    if (event.altKey && key === "/") {
      run(() => (this.propertiesOpen = !this.propertiesOpen));
      return;
    }
    if (event.altKey && key === "s") {
      run(() => (this.snapToObjects = !this.snapToObjects));
      return;
    }
    if (event.shiftKey && event.altKey && key === "c") {
      run(this.copyPng);
      return;
    }
    if (event.shiftKey && key === "1") {
      run(() => this.fitElements(this.elements));
      return;
    }
    if (event.shiftKey && key === "2") {
      run(() =>
        this.fitElements(
          this.elements.filter((item) => this.selectedIds.has(item.id)),
        ),
      );
      return;
    }
    if (event.shiftKey && key === "h" && this.selectedIds.size) {
      run(() => this.flipSelected("horizontal"));
      return;
    }
    if (event.shiftKey && key === "v" && this.selectedIds.size) {
      run(() => this.flipSelected("vertical"));
      return;
    }
    if (key === "i" || (event.shiftKey && (key === "s" || key === "g"))) {
      run(this.pickColor);
      return;
    }
    if (event.shiftKey && key === "f") {
      run(() => {
        this.propertiesOpen = true;
        void this.updateComplete.then(() =>
          this.querySelector<HTMLElement>(".font-family button")?.focus(),
        );
      });
      return;
    }
    if ((key === "s" || key === "g") && !event.altKey) {
      run(() =>
        this.querySelector<HTMLInputElement>(
          key === "s" ? ".stroke-picker-proxy" : ".background-picker-proxy",
        )?.click(),
      );
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const delta = event.key === "PageUp" ? 100 : -100;
      if (event.shiftKey) this.pan.x += delta;
      else this.pan.y += delta;
      this.requestUpdate();
      return;
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      this.selectedIds.size
    ) {
      event.preventDefault();
      this.deleteSelected();
      return;
    }
    if (
      !event.altKey &&
      event.key.startsWith("Arrow") &&
      this.selectedIds.size
    ) {
      event.preventDefault();
      this.nudgeSelected(
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0,
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0,
        event.shiftKey ? 10 : 1,
      );
      return;
    }
    if (event.key === "?") {
      this.dialog = "help";
      return;
    }
    if (event.key === "Escape") {
      this.editingLinearId = null;
      this.selectedIds = new Set();
      this.tool = "selection";
      this.menuOpen = false;
      this.moreToolsOpen = false;
      this.libraryOpen = false;
      this.dialog = null;
      return;
    }
    if (event.key === "Enter" && this.selectedIds.size === 1) {
      const selected = this.elements.find((item) =>
        this.selectedIds.has(item.id),
      ) as MutableElement;
      if (selected.type === "image") this.croppingImageId = selected.id;
      else if (selected.type === "text")
        this.startTextEditing({ x: selected.x, y: selected.y }, selected);
      else {
        const labelId = selected.boundElements?.find(
          (binding) => binding.type === "text",
        )?.id;
        const label = labelId
          ? (this.elements.find((item) => item.id === labelId) as
              | MutableElement
              | undefined)
          : undefined;
        if (label) this.startTextEditing({ x: label.x, y: label.y }, label);
        else
          this.startTextEditing(
            { x: selected.x, y: selected.y },
            undefined,
            selected.id,
          );
      }
      return;
    }
    if (event.key === "Tab" && this.selectedIds.size) {
      run(() => this.cycleSelectedShape(event.shiftKey ? -1 : 1));
      return;
    }
    if (key === "9") {
      this.querySelector<HTMLInputElement>(".image-input")?.click();
      return;
    }
    if (key === "q") {
      this.toolLocked = !this.toolLocked;
      return;
    }
    const shortcuts: Record<string, Tool> = {
      h: "hand",
      v: "selection",
      "1": "selection",
      r: "rectangle",
      "2": "rectangle",
      d: "diamond",
      "3": "diamond",
      o: "ellipse",
      "4": "ellipse",
      a: "arrow",
      "5": "arrow",
      l: "line",
      "6": "line",
      p: "freedraw",
      "7": "freedraw",
      t: "text",
      "8": "text",
      e: "eraser",
      "0": "eraser",
      f: "frame",
      k: "laser",
      n: "stickynote",
      b: "bucket",
    };
    if (!primary && !event.altKey && !event.shiftKey && shortcuts[key]) {
      event.preventDefault();
      this.setTool(shortcuts[key]);
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") this.spacePressed = false;
  };

  private onTextKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      this.textDraft = "";
      this.editingText = null;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
      (event.target as HTMLTextAreaElement).blur();
  };

  private onTextInput = (event: InputEvent) => {
    const area = event.target as HTMLTextAreaElement;
    this.textDraft = area.value;
    area.style.height = "0";
    area.style.height = `${area.scrollHeight}px`;
    if (!this.editingText?.containerId)
      area.style.width = `${Math.max(64, area.scrollWidth + 2)}px`;
  };

  private commitText = () => {
    if (!this.editingText) return;
    const edit = this.editingText;
    const text = this.textDraft.trimEnd();
    if (text.trim()) {
      this.checkpoint();
      const existing = edit.elementId
        ? (this.elements.find((item) => item.id === edit.elementId) as
            | MutableElement
            | undefined)
        : undefined;
      this.elements = commitTextWithExcalidraw({
        elements: this.elements,
        elementId: edit.elementId,
        containerId: edit.containerId,
        point: { x: edit.x, y: edit.y },
        text,
        strokeColor: existing?.strokeColor ?? this.strokeColor,
        fontSize: edit.fontSize,
        fontFamily: edit.fontFamily,
        textAlign: edit.textAlign,
        verticalAlign: edit.verticalAlign,
      }) as WebdrawElement[];
      const element = edit.elementId
        ? this.elements.find((item) => item.id === edit.elementId)
        : this.elements.at(-1);
      this.selectedIds = new Set([edit.containerId ?? element!.id]);
      this.emitChange();
    } else if (edit.elementId) {
      this.selectedIds = new Set([edit.elementId]);
      this.deleteSelected();
    }
    this.textDraft = "";
    this.editingText = null;
    if (!this.toolLocked) this.tool = "selection";
  };

  private startTextEditing(
    point: Point,
    element?: MutableElement,
    containerId?: string,
  ) {
    if (element) {
      this.editingText = {
        x: element.x,
        y: element.y,
        fontSize: element.fontSize ?? this.fontSize,
        fontFamily: element.fontFamily ?? this.fontFamily,
        textAlign: element.textAlign ?? this.textAlign,
        verticalAlign: element.verticalAlign ?? this.verticalAlign,
        width: element.width,
        angle:
          element.type === "text"
            ? textElementAngle(element, this.elements)
            : element.angle,
        elementId: element.id,
        containerId: element.containerId ?? undefined,
      };
      this.textDraft = element.text ?? "";
      this.selectedIds = new Set([element.id]);
    } else if (containerId) {
      const container = this.elements.find((item) => item.id === containerId)!;
      this.editingText = {
        x: container.x + 8,
        y: container.y + container.height / 2 - this.fontSize / 2,
        width: Math.max(64, container.width - 16),
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        textAlign: "center",
        verticalAlign: "middle",
        angle: container.angle,
        containerId,
      };
      this.textDraft = "";
      this.selectedIds = new Set([containerId]);
    } else {
      this.editingText = {
        ...point,
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        textAlign: this.textAlign,
        verticalAlign: this.verticalAlign,
      };
      this.textDraft = "";
    }
  }

  private replaceElement(element: WebdrawElement) {
    this.elements = replaceElementWithExcalidraw(
      this.elements,
      element,
    ) as WebdrawElement[];
  }

  private syncStyleFromElement(element: MutableElement) {
    this.strokeColor = element.strokeColor ?? this.strokeColor;
    this.backgroundColor = element.backgroundColor ?? this.backgroundColor;
    this.strokeWidth = element.strokeWidth ?? this.strokeWidth;
    this.fillStyle = element.fillStyle ?? this.fillStyle;
    this.strokeStyle = element.strokeStyle ?? this.strokeStyle;
    this.roughness = element.roughness ?? this.roughness;
    if (canChangeRoundness(element.type)) this.edgeRound = !!element.roundness;
    this.opacity = element.opacity ?? this.opacity;
    const label = element.type === "text" ? element : this.boundLabel(element);
    if (label) {
      this.fontFamily = label.fontFamily ?? this.fontFamily;
      this.fontSize = label.fontSize ?? this.fontSize;
      this.textAlign = label.textAlign ?? this.textAlign;
      this.verticalAlign = label.verticalAlign ?? this.verticalAlign;
      if (element.type === "stickynote")
        this.strokeColor = label.strokeColor ?? element.strokeColor;
    }
    if (element.type === "arrow") {
      this.arrowType = element.elbowed
        ? "elbow"
        : element.roundness
          ? "round"
          : "sharp";
      this.startArrowhead = element.startArrowhead ?? null;
      this.endArrowhead = element.endArrowhead ?? null;
    }
  }

  private boundLabel(element: MutableElement) {
    const id = element.boundElements?.find(
      (binding: { type: string }) => binding.type === "text",
    )?.id;
    return id
      ? (this.elements.find((item) => item.id === id) as
          | MutableElement
          | undefined)
      : undefined;
  }

  private selectionHandleAt(point: Point): ResizeHandle | "rotate" | null {
    const selected = this.elements.filter(
      (item) => this.selectedIds.has(item.id) && !item.locked,
    );
    return selected.length === this.selectedIds.size
      ? selectionTransformHandleAt(point, selected, this.elements, this.zoom)
      : null;
  }

  private bounds(element: MutableElement) {
    return elementBounds(element, this.elements);
  }

  private hitTest(point: Point) {
    return this.hitTestAll(point)[0];
  }

  private hitTestAll(point: Point) {
    return hitElements(point, this.elements, 8 / this.zoom, true);
  }

  private cursorAt(point: Point) {
    if (this.tool !== "selection") return "";
    const handle = this.selectionHandleAt(point);
    if (handle === "rotate") return "grab";
    if (handle) {
      const selected =
        this.selectedIds.size === 1
          ? this.elements.find((element) => this.selectedIds.has(element.id))
          : undefined;
      return cursorForHandle(handle, selected?.angle);
    }
    const hit = this.hitTest(point);
    return hit && !hit.locked ? "move" : "";
  }

  private selectWithin(rect: { start: Point; end: Point }) {
    this.selectedIds = selectElementsWithinExcalidraw(rect, this.elements);
  }

  private eraseAt(point: Point) {
    const hit = this.hitTest(point);
    if (!hit) return;
    if (!this.drag?.checkpointed) {
      this.checkpoint();
      if (this.drag) this.drag.checkpointed = true;
    }
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
    const result = removeElementsWithExcalidraw(this.elements, deletedIds);
    this.elements = result.elements as WebdrawElement[];
    return result.deletedIds;
  }

  private setZoom(value: number) {
    this.zoom = Math.min(30, Math.max(0.1, Math.round(value * 10) / 10));
  }
  private updateFormFactor() {
    const { width, height } = this.getBoundingClientRect();
    const mobile = isMobileBreakpoint(width, height);
    if (mobile === this.mobile) return;
    this.mobile = mobile;
    this.propertiesOpen = !mobile;
  }

  private isDarkTheme() {
    return (
      this.theme === "dark" ||
      (this.theme === "auto" && !!this.systemTheme?.matches)
    );
  }
  private setTheme(theme: WebdrawTheme) {
    this.theme = theme;
    this.requestUpdate();
  }
  private toggleTheme = () =>
    this.setTheme(this.isDarkTheme() ? "light" : "dark");
  private onSystemThemeChange = () => {
    if (this.theme !== "auto") return;
    this.requestUpdate();
    this.paint();
  };
  private onFontsLoaded = () => this.paint();
  private confirmReset = () => {
    if (
      !this.elements.length ||
      this.ownerDocument.defaultView?.confirm(
        "This will clear the whole canvas. Are you sure?",
      )
    ) {
      this.resetScene();
      this.menuOpen = false;
    }
  };

  private updateSelected(patch: Record<string, unknown>) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = updateElementsWithExcalidraw(
      this.elements,
      this.selectedIds,
      patch,
    ) as WebdrawElement[];
    this.emitChange();
  }

  private setStrokeColor = (value: string) => {
    this.strokeColor = value;
    if (this.selectedIds.size) {
      const ids = new Set(this.selectedIds);
      for (const item of this.elements.filter(
        (element) => ids.has(element.id) && element.type === "stickynote",
      )) {
        for (const binding of item.boundElements ?? [])
          if (binding.type === "text") ids.add(binding.id);
      }
      this.checkpoint();
      this.elements = updateElementsWithExcalidraw(this.elements, ids, {
        strokeColor: value,
      }) as WebdrawElement[];
      this.emitChange();
    }
    this.requestUpdate();
  };
  private setBackground = (value: string) => {
    this.backgroundColor = value;
    this.updateSelected({ backgroundColor: value });
    this.requestUpdate();
  };
  private setFillStyle(value: typeof this.fillStyle) {
    this.fillStyle = value;
    this.updateSelected({ fillStyle: value });
    this.requestUpdate();
  }
  private setStrokeWidth(value: number) {
    this.strokeWidth = value;
    this.updateSelected({ strokeWidth: value });
    this.requestUpdate();
  }
  private setStrokeStyle(value: typeof this.strokeStyle) {
    this.strokeStyle = value;
    this.updateSelected({ strokeStyle: value });
    this.requestUpdate();
  }
  private setRoughness(value: number) {
    this.roughness = value;
    this.updateSelected({ roughness: value });
    this.requestUpdate();
  }
  private setEdges(round: boolean) {
    this.edgeRound = round;
    this.requestUpdate();
    if (
      !this.elements.some(
        (item) =>
          this.selectedIds.has(item.id) && canChangeRoundness(item.type),
      )
    )
      return;
    this.checkpoint();
    this.elements = this.elements.map((item) =>
      this.selectedIds.has(item.id) && canChangeRoundness(item.type)
        ? (newElementWith(item, {
            roundness: edgeRoundness(item.type, round),
          }) as WebdrawElement)
        : item,
    );
    this.emitChange();
  }
  private onOpacity = (event: Event) => {
    this.opacity = Number((event.target as HTMLInputElement).value);
    if (!this.selectedIds.size) {
      this.requestUpdate();
      return;
    }
    const ids = new Set(this.selectedIds);
    for (const item of this.elements.filter((element) => ids.has(element.id)))
      for (const binding of item.boundElements ?? [])
        if (binding.type === "text") ids.add(binding.id);
    if (!this.opacityCheckpointed) {
      this.checkpoint();
      this.opacityCheckpointed = true;
    }
    this.elements = updateElementsWithExcalidraw(this.elements, ids, {
      opacity: this.opacity,
    }) as WebdrawElement[];
    this.emitChange();
    this.requestUpdate();
  };
  private setCanvasColor(value: string) {
    this.canvasColor = value;
    this.requestUpdate();
  }
  private onCanvasColor = (event: InputEvent) =>
    this.setCanvasColor((event.target as HTMLInputElement).value);

  private updateTextStyle(patch: Record<string, unknown>) {
    const ids = new Set<string>();
    for (const item of this.elements) {
      if (this.selectedIds.has(item.id) && item.type === "text")
        ids.add(item.id);
      if (this.selectedIds.has(item.id))
        for (const binding of item.boundElements ?? [])
          if (binding.type === "text") ids.add(binding.id);
    }
    if (!ids.size) {
      this.requestUpdate();
      return;
    }
    this.checkpoint();
    this.elements = updateTextStylesWithExcalidraw(
      this.elements,
      ids,
      patch as never,
    ) as WebdrawElement[];
    this.emitChange();
  }

  private setFontFamily(value: number) {
    this.fontFamily = value;
    this.updateTextStyle({ fontFamily: value });
  }
  private setFontSize(value: number) {
    this.fontSize = value;
    this.updateTextStyle({ fontSize: value });
  }
  private changeFontSize(delta: number) {
    this.setFontSize(Math.max(8, Math.min(96, this.fontSize + delta)));
  }
  private setTextAlign(value: TextAlign) {
    this.textAlign = value;
    this.updateTextStyle({ textAlign: value });
  }
  private setVerticalAlign(value: VerticalAlign) {
    this.verticalAlign = value;
    this.updateTextStyle({ verticalAlign: value });
  }
  private setArrowType(value: typeof this.arrowType) {
    this.arrowType = value;
    this.updateSelected({
      roundness:
        value === "round" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null,
      elbowed: value === "elbow",
    });
    this.requestUpdate();
  }
  private setArrowhead(side: "start" | "end", value: Arrowhead) {
    if (side === "start") this.startArrowhead = value;
    else this.endArrowhead = value;
    this.updateSelected({
      [side === "start" ? "startArrowhead" : "endArrowhead"]: value,
    });
    this.requestUpdate();
  }

  private duplicateSelected = () => {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    const sourceIds = this.movingElementIds();
    const result = duplicateElementsWithExcalidraw(this.elements, sourceIds);
    this.elements = result.elements as WebdrawElement[];
    this.selectedIds = new Set(
      [...this.selectedIds].flatMap((id) => result.idMap.get(id) ?? []),
    );
    this.emitChange();
  };

  private copySelected = async () => {
    const ids = this.movingElementIds();
    this.clipboard = structuredClone(
      this.elements.filter((item) => ids.has(item.id)),
    );
    const fileIds = new Set(
      this.clipboard.flatMap((element) =>
        element.type === "image" && element.fileId ? [element.fileId] : [],
      ),
    );
    const files = Object.fromEntries(
      Object.entries(this.files).filter(([id]) => fileIds.has(id as never)),
    );
    try {
      await this.ownerDocument.defaultView?.navigator.clipboard.writeText(
        JSON.stringify({
          type: "webdraw/clipboard",
          elements: this.clipboard,
          files,
        }),
      );
    } catch {
      /* Keep the in-memory fallback when browser permission is denied. */
    }
  };

  private pasteClipboard = async () => {
    let source = this.clipboard;
    let files: WebdrawBinaryFiles = {};
    try {
      const value =
        await this.ownerDocument.defaultView?.navigator.clipboard.readText();
      if (value) {
        try {
          const data = JSON.parse(value);
          if (Array.isArray(data.elements)) {
            source = data.elements;
            files = data.files ?? {};
          } else {
            this.pasteText(value);
            return;
          }
        } catch {
          this.pasteText(value);
          return;
        }
      }
    } catch {
      /* Use the in-memory fallback. */
    }
    if (!source.length) return;
    this.checkpoint();
    const copies = duplicateExternalElementsWithExcalidraw(
      source,
    ) as WebdrawElement[];
    this.files = { ...this.files, ...files };
    this.loadSceneImages();
    this.elements = [...this.elements, ...copies];
    this.selectedIds = new Set(
      copies
        .filter((item) => !(item as MutableElement).containerId)
        .map((item) => item.id),
    );
    this.emitChange();
  };

  private pasteText(value: string) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.startTextEditing({
      x: (rect.width / 2 - this.pan.x) / this.zoom,
      y: (rect.height / 2 - this.pan.y) / this.zoom,
    });
    this.textDraft = value;
    this.commitText();
  }

  private parseLibrary(raw: string): LibraryItem[] {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("Invalid Webdraw library");
    return data.map((candidate: unknown) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        !Array.isArray((candidate as LibraryItem).elements) ||
        !(candidate as LibraryItem).elements.every(
          (element) =>
            element &&
            typeof element.id === "string" &&
            typeof element.type === "string" &&
            !LIBRARY_DISABLED_TYPES.has(element.type as never),
        )
      )
        throw new Error("Invalid Webdraw library item");
      const item = candidate as LibraryItem;
      return {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : this.ownerDocument.defaultView!.crypto.randomUUID(),
        elements: item.elements,
        name: typeof item.name === "string" ? item.name : undefined,
      };
    });
  }

  private loadLibrary() {
    let raw = this.library;
    if (raw == null && this.storageKey) {
      try {
        raw =
          this.ownerDocument.defaultView?.localStorage.getItem(
            this.storageKey,
          ) ?? null;
      } catch {
        /* Storage may be unavailable in embedded/private contexts. */
      }
    }
    if (raw == null) {
      this.libraryItems = [];
      return;
    }
    try {
      this.libraryItems = this.parseLibrary(raw || "[]");
      this.emitLibraryChange();
    } catch (error) {
      this.dispatchEvent(
        new CustomEvent("webdraw-error", {
          detail: error,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private saveLibrary(items: LibraryItem[]) {
    this.libraryItems = items;
    try {
      if (this.storageKey)
        this.ownerDocument.defaultView?.localStorage.setItem(
          this.storageKey,
          JSON.stringify(items),
        );
    } catch {
      /* The host can persist webdraw-library-change instead. */
    }
    this.emitLibraryChange();
  }

  private emitLibraryChange() {
    this.dispatchEvent(
      new CustomEvent("webdraw-library-change", {
        detail: { libraryItems: this.libraryItems },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private addSelectedToLibrary = () => {
    const selected = selectedElementsWithBindings(
      this.elements,
      this.selectedIds,
    );
    if (!selected.length) return;
    if (
      selected.some((element) =>
        LIBRARY_DISABLED_TYPES.has(element.type as never),
      )
    ) {
      this.ownerDocument.defaultView?.alert(
        "Images and embeds cannot be added to the library.",
      );
      return;
    }
    const item: LibraryItem = {
      id: this.ownerDocument.defaultView!.crypto.randomUUID(),
      elements: selected.map(
        (element) => deepCopyElement(element) as WebdrawElement,
      ),
    };
    this.saveLibrary([item, ...this.libraryItems]);
  };

  private insertLibraryItem(item: LibraryItem) {
    const copies = duplicateExternalElementsWithExcalidraw(
      item.elements,
    ) as WebdrawElement[];
    if (!copies.length || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const center = {
      x: (rect.width / 2 - this.pan.x) / this.zoom,
      y: (rect.height / 2 - this.pan.y) / this.zoom,
    };
    const box = commonBounds(copies);
    const ids = new Set(
      copies
        .filter((element) => !(element as MutableElement).containerId)
        .map((element) => element.id),
    );
    const shifted = dragElementsWithExcalidraw({
      elements: copies,
      selectedIds: ids,
      originals: new Map(
        copies.map((element) => [element.id, structuredClone(element)]),
      ),
      offset: {
        x: center.x - box.x - box.width / 2,
        y: center.y - box.y - box.height / 2,
      },
    }) as WebdrawElement[];
    this.checkpoint();
    this.elements = [...this.elements, ...shifted];
    this.selectedIds = ids;
    this.libraryOpen = false;
    this.emitChange();
  }

  private removeLibraryItem(id: string) {
    this.saveLibrary(this.libraryItems.filter((item) => item.id !== id));
  }

  private groupSelectionFor(element: WebdrawElement) {
    const groupId = element.groupIds.at(-1);
    return groupId
      ? new Set(
          this.elements
            .filter((item) => item.groupIds.includes(groupId))
            .map((item) => item.id),
        )
      : new Set([element.id]);
  }

  private movingElementIds() {
    const ids = new Set(this.selectedIds);
    for (const selected of this.elements.filter((element) =>
      ids.has(element.id),
    )) {
      for (const binding of selected.boundElements ?? [])
        if (binding.type === "text") ids.add(binding.id);
      if (selected.type === "frame")
        for (const child of this.elements.filter(
          (element) => element.frameId === selected.id,
        )) {
          ids.add(child.id);
          for (const binding of child.boundElements ?? [])
            if (binding.type === "text") ids.add(binding.id);
        }
    }
    return ids;
  }

  private nudgeSelected(dx: number, dy: number, amount: number) {
    this.checkpoint();
    const originals = new Map(
      this.elements.map((element) => [element.id, structuredClone(element)]),
    );
    this.elements = dragElementsWithExcalidraw({
      elements: this.elements,
      selectedIds: this.selectedIds,
      originals,
      offset: { x: dx * amount, y: dy * amount },
    }) as WebdrawElement[];
    this.emitChange();
  }

  private snappedDelta(ids: Set<string>, dx: number, dy: number) {
    const moving = this.elements
      .filter((item) => this.selectedIds.has(item.id))
      .map((item) => this.bounds(item as MutableElement));
    const fixed = this.elements
      .filter((item) => !ids.has(item.id))
      .map((item) => this.bounds(item as MutableElement));
    if (!moving.length || !fixed.length) return { x: dx, y: dy };
    const coordinates = (
      boxes: ReturnType<WebDraw["bounds"]>[],
      axis: "x" | "y",
    ) =>
      boxes.flatMap((box) =>
        axis === "x"
          ? [box.x, box.x + box.width / 2, box.x + box.width]
          : [box.y, box.y + box.height / 2, box.y + box.height],
      );
    const nearest = (sources: number[], targets: number[], delta: number) => {
      let adjustment = 7 / this.zoom;
      for (const source of sources)
        for (const target of targets)
          if (Math.abs(target - source - delta) < Math.abs(adjustment))
            adjustment = target - source - delta;
      return Math.abs(adjustment) < 7 / this.zoom ? delta + adjustment : delta;
    };
    return {
      x: nearest(coordinates(moving, "x"), coordinates(fixed, "x"), dx),
      y: nearest(coordinates(moving, "y"), coordinates(fixed, "y"), dy),
    };
  }

  private setSelectedLink = () => {
    const link = this.ownerDocument.defaultView?.prompt(
      "Paste a link",
      "https://",
    );
    if (link) this.updateSelected({ link });
  };

  private groupSelected = () => {
    if (this.selectedIds.size < 2) return;
    const groupId = this.ownerDocument.defaultView!.crypto.randomUUID();
    this.checkpoint();
    this.elements = groupElementsWithExcalidraw(
      this.elements,
      this.selectedIds,
      groupId,
    ) as WebdrawElement[];
    this.emitChange();
  };

  private ungroupSelected = () => {
    this.checkpoint();
    this.elements = ungroupElementsWithExcalidraw(
      this.elements,
      this.selectedIds,
    ) as WebdrawElement[];
    this.emitChange();
  };

  private sendBackward = () => this.moveSelectedLayer(-1);
  private bringForward = () => this.moveSelectedLayer(1);
  private sendToBack = () => this.moveSelectedToEdge("back");
  private bringToFront = () => this.moveSelectedToEdge("front");

  private moveSelectedLayer(direction: -1 | 1) {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = moveElementsInLayerWithExcalidraw(
      this.elements,
      this.selectedIds,
      direction < 0 ? "backward" : "forward",
    ) as WebdrawElement[];
    this.emitChange();
  }

  private moveSelectedToEdge(edge: "back" | "front") {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = moveElementsInLayerWithExcalidraw(
      this.elements,
      this.selectedIds,
      edge,
    ) as WebdrawElement[];
    this.emitChange();
  }

  private toggleSelectedLock = () => {
    const locked = this.elements.some(
      (item) => this.selectedIds.has(item.id) && item.locked,
    );
    this.updateSelected({ locked: !locked });
  };

  private copyStyles = () => {
    const item = this.elements.find((element) =>
      this.selectedIds.has(element.id),
    ) as MutableElement | undefined;
    if (!item) return;
    const label = item.type === "text" ? item : this.boundLabel(item),
      values: Record<string, any> = {
        ...item,
        ...(label
          ? {
              fontFamily: label.fontFamily,
              fontSize: label.fontSize,
              textAlign: label.textAlign,
              verticalAlign: label.verticalAlign,
            }
          : {}),
      };
    this.styleClipboard = Object.fromEntries(
      [
        "strokeColor",
        "backgroundColor",
        "fillStyle",
        "strokeWidth",
        "strokeStyle",
        "roughness",
        "opacity",
        "fontFamily",
        "fontSize",
        "textAlign",
        "verticalAlign",
        "startArrowhead",
        "endArrowhead",
        "roundness",
        "elbowed",
      ]
        .filter((key) => values[key] !== undefined)
        .map((key) => [key, values[key]]),
    );
  };

  private pasteStyles = () => {
    if (!this.styleClipboard) return;
    const textKeys = ["fontFamily", "fontSize", "textAlign", "verticalAlign"],
      text = Object.fromEntries(
        Object.entries(this.styleClipboard).filter(([key]) =>
          textKeys.includes(key),
        ),
      );
    const shape = Object.fromEntries(
      Object.entries(this.styleClipboard).filter(
        ([key]) => !textKeys.includes(key),
      ),
    );
    const textIds = new Set<string>();
    for (const item of this.elements) {
      if (this.selectedIds.has(item.id) && item.type === "text")
        textIds.add(item.id);
      if (this.selectedIds.has(item.id))
        for (const binding of item.boundElements ?? [])
          if (binding.type === "text") textIds.add(binding.id);
    }
    this.checkpoint();
    let elements = Object.keys(shape).length
      ? updateElementsWithExcalidraw(this.elements, this.selectedIds, shape)
      : this.elements;
    if (Object.keys(text).length && textIds.size)
      elements = updateTextStylesWithExcalidraw(
        elements,
        textIds,
        text as never,
      );
    this.elements = elements as WebdrawElement[];
    this.emitChange();
  };

  private alignSelected(key: string) {
    if (this.selectedIds.size < 2) return;
    this.checkpoint();
    this.elements = alignElementsWithExcalidraw(
      this.elements,
      this.selectedIds,
      {
        axis: key === "ArrowLeft" || key === "ArrowRight" ? "x" : "y",
        position: key === "ArrowLeft" || key === "ArrowUp" ? "start" : "end",
      },
    ) as WebdrawElement[];
    this.emitChange();
  }

  private flipSelected(axis: "horizontal" | "vertical") {
    if (!this.selectedIds.size) return;
    this.checkpoint();
    this.elements = flipElementsWithExcalidraw(
      this.elements,
      this.selectedIds,
      axis,
    ) as WebdrawElement[];
    this.emitChange();
  }

  private cycleSelectedShape(direction: -1 | 1) {
    const types = ["rectangle", "diamond", "ellipse"] as const;
    const selected = this.elements.find((item) =>
      this.selectedIds.has(item.id),
    );
    const index = selected
      ? types.indexOf(selected.type as (typeof types)[number])
      : -1;
    if (!selected || index < 0) return;
    this.updateSelected({
      type: types[(index + direction + types.length) % types.length],
    });
  }

  private createFlowchartNode(key: string) {
    const source = this.elements.find((item) => this.selectedIds.has(item.id));
    if (!source) return;
    const direction = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    }[key] as "up" | "right" | "down" | "left";
    const result = createFlowchartNodeWithExcalidraw(
      this.elements,
      source.id,
      direction,
      this.endArrowhead,
    );
    if (!result?.nodeId) return;
    this.checkpoint();
    this.elements = result.elements as WebdrawElement[];
    this.selectedIds = new Set([result.nodeId]);
    this.emitChange();
  }

  private navigateFlowchart(key: string) {
    const source = this.elements.find((item) => this.selectedIds.has(item.id));
    if (!source) return;
    const direction = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    }[key] as "up" | "right" | "down" | "left";
    const map = new Map(
      this.elements.map((element) => [element.id, element]),
    ) as never;
    const id = this.flowchartNavigator.exploreByDirection(
      source,
      map,
      direction,
    );
    const target = id
      ? this.elements.find((element) => element.id === id)
      : undefined;
    if (target) {
      this.selectedIds = new Set([target.id]);
      this.syncStyleFromElement(target as MutableElement);
      this.requestUpdate();
    }
  }

  private fitElements(elements: readonly WebdrawElement[]) {
    if (!elements.length || !this.canvas) return;
    const boxes = elements.map((item) => this.bounds(item as MutableElement));
    const minX = Math.min(...boxes.map((box) => box.x)),
      minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width)),
      maxY = Math.max(...boxes.map((box) => box.y + box.height));
    const rect = this.canvas.getBoundingClientRect(),
      padding = 64;
    this.zoom = Math.min(
      1,
      Math.max(
        0.1,
        Math.min(
          (rect.width - padding * 2) / Math.max(1, maxX - minX),
          (rect.height - padding * 2) / Math.max(1, maxY - minY),
        ),
      ),
    );
    this.pan = {
      x: rect.width / 2 - ((minX + maxX) / 2) * this.zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * this.zoom,
    };
    this.requestUpdate();
  }

  private pastePlaintext = async () => {
    try {
      const text =
        await this.ownerDocument.defaultView?.navigator.clipboard.readText();
      if (!text || !this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.startTextEditing({
        x: (rect.width / 2 - this.pan.x) / this.zoom,
        y: (rect.height / 2 - this.pan.y) / this.zoom,
      });
      this.textDraft = text;
      this.commitText();
    } catch {
      /* Clipboard permission is browser-controlled. */
    }
  };

  private pickColor = async () => {
    const EyeDropper = (this.ownerDocument.defaultView as any)?.EyeDropper;
    if (!EyeDropper) return;
    try {
      this.setStrokeColor((await new EyeDropper().open()).sRGBHex);
    } catch {
      /* User cancelled. */
    }
  };

  private focusElement(element: WebdrawElement) {
    const rect = this.canvas!.getBoundingClientRect(),
      box = this.bounds(element as MutableElement);
    this.pan = {
      x: rect.width / 2 - (box.x + box.width / 2) * this.zoom,
      y: rect.height / 2 - (box.y + box.height / 2) * this.zoom,
    };
    this.selectedIds = new Set([element.id]);
    this.dialog = null;
    this.paint();
  }

  private emitChange() {
    this.dispatchEvent(
      new CustomEvent("webdraw-change", {
        detail: {
          elements: this.elements,
          appState: this.getAppState(),
          files: this.files,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private saveScene = () => {
    const data = JSON.stringify(
      {
        type: "webdraw",
        version: 2,
        source: "webdraw",
        elements: this.elements,
        appState: this.getAppState(),
        files: this.files,
      },
      null,
      2,
    );
    this.download(
      new Blob([data], { type: "application/json" }),
      "drawing.webdraw",
    );
    this.menuOpen = false;
  };

  private openScene = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as WebdrawInitialData;
      if (!Array.isArray(data.elements))
        throw new Error("Invalid Webdraw file");
      this.updateScene(data);
      this.menuOpen = false;
    } catch (error) {
      this.dispatchEvent(
        new CustomEvent("webdraw-error", {
          detail: error,
          bubbles: true,
          composed: true,
        }),
      );
    } finally {
      input.value = "";
    }
  };

  private exportPng = async () => {
    const blob = await new Promise<Blob | null>((resolve) =>
      this.createExportCanvas().toBlob(resolve, "image/png"),
    );
    if (!blob) return;
    let output = blob;
    if (this.exportEmbedScene) {
      const chunks = extractPng(new Uint8Array(await blob.arrayBuffer()));
      chunks.splice(
        -1,
        0,
        pngText.encode(
          "application/vnd.webdraw+json",
          encodeSceneMetadata(this.serializedScene()),
        ),
      );
      output = new Blob([encodePng(chunks)], { type: "image/png" });
    }
    this.download(
      output,
      this.exportEmbedScene ? "drawing.webdraw.png" : "drawing.png",
    );
    this.dialog = null;
  };

  private exportSvg = () => {
    const { elements, width, height, scrollX, scrollY } = this.exportGeometry();
    const svg = renderExcalidrawElementsToSvg({
      elements,
      files: this.files,
      theme: this.exportDarkMode ? "dark" : "light",
      width,
      height,
      scale: this.exportScale,
      scrollX,
      scrollY,
      background: this.exportBackground
        ? this.exportDarkMode
          ? "#121212"
          : this.canvasColor
        : null,
      canvasBackgroundColor: this.canvasColor,
      fontFamilyString: (fontFamily) => this.fontName(fontFamily),
      ownerDocument: this.ownerDocument,
    });
    if (this.exportEmbedScene) {
      const metadata = this.ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "metadata",
      );
      metadata.innerHTML = `<!-- payload-type:application/vnd.webdraw+json --><!-- payload-version:2 --><!-- payload-start -->${this.ownerDocument.defaultView!.btoa(encodeSceneMetadata(this.serializedScene()))}<!-- payload-end -->`;
      svg.appendChild(metadata);
    }
    const svgData =
      new this.ownerDocument.defaultView!.XMLSerializer().serializeToString(
        svg,
      );
    this.download(
      new Blob([svgData], { type: "image/svg+xml" }),
      "drawing.svg",
    );
    this.dialog = null;
  };

  private copyPng = async () => {
    const blob = await new Promise<Blob | null>((resolve) =>
      this.createExportCanvas().toBlob(resolve, "image/png"),
    );
    const win = this.ownerDocument.defaultView as any;
    if (!blob || !win?.ClipboardItem || !win.navigator.clipboard) return;
    await win.navigator.clipboard.write([
      new win.ClipboardItem({ "image/png": blob }),
    ]);
    this.dialog = null;
  };

  private exportElements() {
    return this.exportSelectionOnly && this.selectedIds.size
      ? selectedElementsWithBindings(this.elements, this.selectedIds)
      : this.elements;
  }

  private serializedScene() {
    return JSON.stringify({
      type: "webdraw",
      version: 2,
      source: "webdraw",
      elements: this.exportElements(),
      appState: this.getAppState(),
      files: this.files,
    });
  }

  private exportGeometry() {
    const elements = this.exportElements();
    const boxes = elements.map((item) => this.bounds(item as MutableElement));
    const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0,
      minY = boxes.length ? Math.min(...boxes.map((box) => box.y)) : 0;
    const maxX = boxes.length
        ? Math.max(...boxes.map((box) => box.x + box.width))
        : 1,
      maxY = boxes.length
        ? Math.max(...boxes.map((box) => box.y + box.height))
        : 1;
    const padding = this.exportPadding;
    return {
      elements,
      scrollX: padding - minX,
      scrollY: padding - minY,
      width: Math.max(
        1,
        Math.ceil((maxX - minX + padding * 2) * this.exportScale),
      ),
      height: Math.max(
        1,
        Math.ceil((maxY - minY + padding * 2) * this.exportScale),
      ),
    };
  }

  private createExportCanvas() {
    const { elements, width, height, scrollX, scrollY } = this.exportGeometry();
    const canvas = this.ownerDocument.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    if (this.exportBackground) {
      context.fillStyle = this.exportDarkMode ? "#121212" : this.canvasColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.scale(this.exportScale, this.exportScale);
    const roughCanvas = rough.canvas(canvas);
    renderExcalidrawElements({
      elements,
      context,
      roughCanvas,
      imageCache: this.imageCache,
      theme: this.exportDarkMode ? "dark" : "light",
      zoom: 1,
      scrollX,
      scrollY,
      canvasBackgroundColor: this.canvasColor,
      isExporting: true,
    });
    return canvas;
  }

  private paintExportPreview() {
    const preview = this.querySelector<HTMLCanvasElement>(
      ".export-preview canvas",
    );
    if (!preview) return;
    const source = this.createExportCanvas(),
      maxWidth = 480,
      maxHeight = 260,
      scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
    preview.width = Math.max(1, source.width * scale);
    preview.height = Math.max(1, source.height * scale);
    preview
      .getContext("2d")
      ?.drawImage(source, 0, 0, preview.width, preview.height);
  }

  private openImage = async (event: Event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    const win = this.ownerDocument.defaultView!;
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new win.FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = new win.Image();
    image.onload = () => {
      this.checkpoint();
      const rect = this.canvas!.getBoundingClientRect(),
        width = Math.min(400, image.naturalWidth),
        height = (width * image.naturalHeight) / image.naturalWidth;
      const point = {
        x: (rect.width / 2 - this.pan.x) / this.zoom,
        y: (rect.height / 2 - this.pan.y) / this.zoom,
      };
      const fileId = win.crypto.randomUUID() as WebdrawBinaryFileData["id"];
      const element = newImageElement({
        type: "image",
        x: point.x - width / 2,
        y: point.y - height / 2,
        width,
        height,
        status: "saved",
        fileId,
        roundness: edgeRoundness("image", this.edgeRound),
      }) as WebdrawElement;
      this.files = {
        ...this.files,
        [fileId]: {
          id: fileId,
          dataURL: source,
          mimeType: file.type || "application/octet-stream",
          created: Date.now(),
        },
      };
      this.imageCache.set(fileId, { image, mimeType: file.type });
      this.elements = [...this.elements, element];
      this.selectedIds = new Set([element.id]);
      this.tool = "selection";
      this.emitChange();
    };
    image.src = source;
    input.value = "";
  };

  private download(blob: Blob, name: string) {
    const URLClass = this.ownerDocument.defaultView!.URL;
    const url = URLClass.createObjectURL(blob);
    const anchor = this.ownerDocument.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URLClass.revokeObjectURL(url);
  }

  private paint(includeSelection = true) {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const win = this.ownerDocument.defaultView;
    const dpr = win?.devicePixelRatio ?? 1;
    const width = Math.max(1, Math.round(rect.width * dpr)),
      height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle =
      this.isDarkTheme() && this.canvasColor === "#ffffff"
        ? "#121212"
        : this.canvasColor;
    context.fillRect(0, 0, rect.width, rect.height);
    if (this.gridModeEnabled) this.paintGrid(context, rect.width, rect.height);
    context.save();
    context.scale(this.zoom, this.zoom);
    const roughCanvas = rough.canvas(canvas);
    renderExcalidrawElements({
      elements: this.elements,
      context,
      roughCanvas,
      imageCache: this.imageCache,
      theme: this.isDarkTheme() ? "dark" : "light",
      zoom: this.zoom,
      scrollX: this.pan.x / this.zoom,
      scrollY: this.pan.y / this.zoom,
      canvasBackgroundColor: this.canvasColor,
      selectedIds: this.selectedIds,
      editingTextId: this.editingText?.elementId,
    });
    if (includeSelection) {
      context.save();
      context.translate(this.pan.x / this.zoom, this.pan.y / this.zoom);
      this.paintSelection(context);
      context.restore();
    }
    context.restore();
  }

  private paintGrid(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const step = 20 * this.zoom;
    context.save();
    context.strokeStyle = this.isDarkTheme() ? "#2e2d39" : "#e7e7ed";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = ((this.pan.x % step) + step) % step; x < width; x += step) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = ((this.pan.y % step) + step) % step; y < height; y += step) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
    context.restore();
  }

  private loadSceneImages() {
    this.imageCache.clear();
    const ImageClass = this.ownerDocument.defaultView?.Image;
    if (!ImageClass) return;
    for (const file of Object.values(this.files)) {
      const image = new ImageClass();
      image.onload = () => this.paint();
      image.src = file.dataURL;
      this.imageCache.set(file.id, { image, mimeType: file.mimeType });
    }
  }

  private getEmbedUrl(element: MutableElement) {
    const value = element.customData?.embedUrl ?? element.link;
    return this.safeUrl(value);
  }

  private safeUrl(value?: string | null) {
    if (!value) return null;
    try {
      const url = new this.ownerDocument.defaultView!.URL(
        value,
        this.ownerDocument.baseURI,
      );
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  private fontName(fontFamily: number) {
    if (fontFamily === FONT_FAMILY["Lilita One"])
      return "'Lilita One', sans-serif";
    if (fontFamily === FONT_FAMILY.Nunito)
      return "Nunito, Assistant, sans-serif";
    if (fontFamily === FONT_FAMILY["Comic Shanns"])
      return "'Comic Shanns', Cascadia, monospace";
    if (fontFamily === FONT_FAMILY.Cascadia) return "Cascadia, monospace";
    if (
      fontFamily === FONT_FAMILY.Helvetica ||
      fontFamily === FONT_FAMILY.Assistant
    )
      return "Assistant, sans-serif";
    if (
      fontFamily === FONT_FAMILY.Excalifont ||
      fontFamily === FONT_FAMILY.Virgil
    )
      return "Excalifont, Virgil, sans-serif";
    return "Nunito, Assistant, sans-serif";
  }

  private paintSelection(context: CanvasRenderingContext2D) {
    context.save();
    context.strokeStyle = this.isDarkTheme() ? "#69db7c" : "#2f9e44";
    context.lineWidth = 1 / this.zoom;
    context.setLineDash([]);
    const selected = this.elements.filter((element) =>
      this.selectedIds.has(element.id),
    );
    for (const item of selected) {
      const box = elementAbsoluteBox(item, this.elements),
        gap = 4 / this.zoom;
      context.save();
      context.translate(box.cx, box.cy);
      context.rotate(item.angle);
      context.translate(-box.cx, -box.cy);
      context.strokeRect(
        box.x - gap,
        box.y - gap,
        box.width + gap * 2,
        box.height + gap * 2,
      );
      context.restore();
      if (
        item.id === this.editingLinearId &&
        (item.type === "line" || item.type === "arrow")
      ) {
        context.fillStyle = this.isDarkTheme() ? "#1e1e1e" : "#ffffff";
        for (const [x, y] of linearPoints(item, this.elements)) {
          context.beginPath();
          context.arc(x, y, 5 / this.zoom, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
      } else if (
        this.selectedIds.size === 1 &&
        !(item as MutableElement).locked
      ) {
        context.fillStyle = this.isDarkTheme() ? "#1e1e1e" : "#ffffff";
        for (const bounds of Object.values(
          elementTransformHandles(item, this.elements, this.zoom),
        )) {
          if (!bounds) continue;
          const [x, y, width, height] = bounds;
          context.fillRect(x, y, width, height);
          context.strokeRect(x, y, width, height);
        }
      }
    }
    if (selected.length > 1) {
      const box = commonBounds(selected);
      context.strokeRect(box.x, box.y, box.width, box.height);
      context.fillStyle = this.isDarkTheme() ? "#1e1e1e" : "#ffffff";
      for (const bounds of Object.values(
        selectionTransformHandles(selected, this.elements, this.zoom),
      )) {
        if (!bounds) continue;
        const [x, y, width, height] = bounds;
        context.fillRect(x, y, width, height);
        context.strokeRect(x, y, width, height);
      }
    }
    if (this.selectionRect) {
      const box = normalizeBounds(
        this.selectionRect.start,
        this.selectionRect.end,
      );
      context.fillStyle = "rgba(105,101,219,.08)";
      context.fillRect(box.x, box.y, box.width, box.height);
      context.setLineDash([4 / this.zoom, 4 / this.zoom]);
      context.strokeRect(box.x, box.y, box.width, box.height);
    }
    context.restore();
  }
}

if (!customElements.get("web-draw")) customElements.define("web-draw", WebDraw);

if (import.meta.env.DEV) {
  const check = new WebDraw();
  console.assert(
    (check as any).fontFamily === FONT_FAMILY.Nunito &&
      (check as any).roughness === 0 &&
      (check as any).fontName(FONT_FAMILY.Excalifont).startsWith("Excalifont"),
  );
  console.assert(
    (check as any).fontName(FONT_FAMILY["Lilita One"]).includes("Lilita One"),
  );
  const setBackground = (check as any).setBackground as (color: string) => void;
  setBackground("#ffc9c9");
  console.assert((check as any).backgroundColor === "#ffc9c9");
  console.assert(
    (check as any).strokeColor === DEFAULT_ELEMENT_STROKE_PICKS[0],
  );
  const rectangle = newElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
  });
  const library = (check as any).parseLibrary(
    JSON.stringify([{ name: "Box", elements: [rectangle] }]),
  ) as LibraryItem[];
  console.assert(library.length === 1 && library[0].name === "Box");
  try {
    (check as any).parseLibrary('{"libraryItems":[]}');
    console.assert(false, "Invalid Webdraw library was accepted");
  } catch {
    /* Webdraw libraries must be item arrays. */
  }
  const stickyNote = newStickyNoteElement({
    type: "stickynote",
    x: 120,
    y: 0,
    width: 100,
    height: 80,
  });
  const ellipse = newElement({
    type: "ellipse",
    x: 240,
    y: 0,
    width: 100,
    height: 80,
  });
  check.elements = [rectangle, stickyNote, ellipse];
  check.selectedIds = new Set([rectangle.id, stickyNote.id, ellipse.id]);
  (check as any).setEdges(true);
  console.assert(
    check.elements[0].roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS,
  );
  console.assert(
    check.elements[1].roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS,
  );
  console.assert(check.elements[2].roundness === null);
  (check as any).setEdges(false);
  console.assert(
    check.elements[0].roundness === null &&
      check.elements[1].roundness === null,
  );
}

declare global {
  interface HTMLElementTagNameMap {
    "web-draw": WebDraw;
  }
}
