<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ demo: string }>();

type WebdrawElement = HTMLElement & {
  theme: "auto" | "light" | "dark";
  viewModeEnabled: boolean;
  zenModeEnabled: boolean;
  gridModeEnabled: boolean;
  libraryEnabled: "on" | "off";
  library: string | null;
  storageKey: string;
  initialData: Record<string, unknown>;
  elements: unknown[];
  getSceneElements(): readonly unknown[];
  getAppState(): Record<string, unknown>;
  updateScene(scene: Record<string, unknown>): void;
  addFiles(files: readonly Record<string, unknown>[]): void;
  resetScene(): void;
};

const drawing = ref<WebdrawElement>();
const output = ref("Use the controls above the canvas.");
const instanceKey = ref(0);
const storageKey = "webdraw-docs-library";

const rectangle = (id = "docs-rectangle", x = 80) => ({
  id,
  type: "rectangle",
  x,
  y: 60,
  width: 220,
  height: 120,
  angle: 0,
  strokeColor: "#2b8a3e",
  backgroundColor: "#d3f9d8",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: { type: 3 },
  seed: 42,
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  created: 1,
  link: null,
  locked: false,
});

const scene = (background = "#ffffff") => ({
  elements: [rectangle()],
  appState: {
    theme: "light",
    viewBackgroundColor: background,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    currentItemRoundness: "round",
  },
});

const library = JSON.stringify([
  { id: "docs-library-box", name: "Green box", elements: [rectangle()] },
]);

const show = (value: unknown) => {
  output.value =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const useElement = (run: (element: WebdrawElement) => void) => {
  if (drawing.value) run(drawing.value);
};

const setAttribute = (name: string, value?: string) =>
  useElement((element) => {
    value === undefined
      ? element.toggleAttribute(name)
      : element.setAttribute(name, value);
    show(`${name}=${JSON.stringify(element.getAttribute(name))}`);
  });

type Action = { label: string; run: () => void };
const button = (label: string, run: () => void): Action => ({ label, run });

const actions = computed<Action[]>(() => {
  const attributeToggle = (name: string) => [
    button(`Toggle ${name}`, () => setAttribute(name)),
  ];
  const propertyToggle = (name: keyof WebdrawElement) => [
    button(`Toggle ${String(name)}`, () =>
      useElement((element) => {
        (element[name] as boolean) = !element[name];
        show(`${String(name)} = ${String(element[name])}`);
      }),
    ),
  ];

  switch (props.demo) {
    case "quick-start":
      return [
        button("Light", () => setAttribute("theme", "light")),
        button("Dark", () => setAttribute("theme", "dark")),
        button("Clear", () => drawing.value?.resetScene()),
      ];
    case "theme":
      return ["auto", "light", "dark"].map((theme) =>
        button(theme, () => setAttribute("theme", theme)),
      );
    case "view-mode":
      return attributeToggle("view-mode");
    case "zen-mode":
      return attributeToggle("zen-mode");
    case "grid-mode":
      return attributeToggle("grid-mode");
    case "library":
      return [
        button("Load library", () => {
          setAttribute("library-enabled", "on");
          setAttribute("library", library);
        }),
        button("Clear library", () => setAttribute("library", "[]")),
        button("Hide library", () => setAttribute("library-enabled", "off")),
      ];
    case "storage-key":
      return [
        button("Load saved library", () =>
          useElement((element) => {
            localStorage.setItem(storageKey, library);
            element.removeAttribute("library");
            element.setAttribute("library-enabled", "on");
            element.setAttribute("storage-key", storageKey);
            show(`Loaded the library stored at ${storageKey}`);
          }),
        ),
        button("Disable persistence", () => setAttribute("storage-key", "")),
      ];
    case "theme-property":
      return ["auto", "light", "dark"].map((theme) =>
        button(theme, () =>
          useElement((element) => {
            element.theme = theme as WebdrawElement["theme"];
            show(`theme = ${JSON.stringify(element.theme)}`);
          }),
        ),
      );
    case "view-mode-property":
      return propertyToggle("viewModeEnabled");
    case "zen-mode-property":
      return propertyToggle("zenModeEnabled");
    case "grid-mode-property":
      return propertyToggle("gridModeEnabled");
    case "library-property":
      return [
        button("Set library property", () =>
          useElement((element) => {
            element.libraryEnabled = "on";
            element.library = library;
            show("library property loaded");
          }),
        ),
        button("Clear", () =>
          useElement((element) => (element.library = "[]")),
        ),
      ];
    case "storage-key-property":
      return [
        button("Set storageKey", () =>
          useElement((element) => {
            localStorage.setItem(storageKey, library);
            element.library = null;
            element.storageKey = storageKey;
            show(`storageKey = ${JSON.stringify(element.storageKey)}`);
          }),
        ),
        button("Disable", () =>
          useElement((element) => (element.storageKey = "")),
        ),
      ];
    case "initial-data":
      return [
        button("Set initialData", () =>
          useElement((element) => {
            element.initialData = scene("#fff9db");
            show(element.initialData);
          }),
        ),
      ];
    case "elements":
      return [
        button("Set two elements", () =>
          useElement((element) => {
            element.elements = [rectangle(), rectangle("docs-second", 340)];
            show(`elements.length = ${element.elements.length}`);
          }),
        ),
        button("Set empty array", () =>
          useElement((element) => {
            element.elements = [];
            show("elements.length = 0");
          }),
        ),
      ];
    case "get-elements":
      return [
        button("Call getSceneElements()", () =>
          show(drawing.value?.getSceneElements()),
        ),
      ];
    case "get-state":
      return [
        button("Call getAppState()", () => show(drawing.value?.getAppState())),
      ];
    case "update-scene":
      return [
        button("Update scene", () =>
          drawing.value?.updateScene(scene("#e9f7ef")),
        ),
        button("Change zoom and background", () =>
          drawing.value?.updateScene({
            appState: { zoom: 1.35, viewBackgroundColor: "#fff9db" },
          }),
        ),
      ];
    case "add-files":
      return [
        button("Register an image file", () =>
          useElement((element) => {
            const file = {
              id: "docs-image-file",
              dataURL:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
              mimeType: "image/png",
              created: Date.now(),
            };
            element.addFiles([file]);
            show(file);
          }),
        ),
      ];
    case "reset-scene":
      return [button("Call resetScene()", () => drawing.value?.resetScene())];
    case "ready-event":
      return [button("Remount component", () => instanceKey.value++)];
    case "change-event":
      return [
        button("Trigger scene change", () =>
          drawing.value?.updateScene(scene("#e9f7ef")),
        ),
      ];
    case "library-change-event":
      return [button("Change library", () => setAttribute("library", library))];
    case "error-event":
      return [
        button("Pass invalid library JSON", () =>
          setAttribute("library", "not json"),
        ),
      ];
    default:
      return [];
  }
});

const onReady = (event: Event) => {
  const element = event.currentTarget as WebdrawElement;
  drawing.value = element;
  if (props.demo === "ready-event") show("webdraw-ready fired");
  if (props.demo !== "initial-data") element.updateScene(scene());
};

const onChange = (event: Event) => {
  if (props.demo === "change-event") show((event as CustomEvent).detail);
};

const onLibraryChange = (event: Event) => {
  if (props.demo === "library-change-event")
    show((event as CustomEvent).detail);
};

const onError = (event: Event) => {
  if (props.demo === "error-event") {
    const error = (event as CustomEvent).detail;
    show(error instanceof Error ? error.message : error);
  }
};
</script>

<template>
  <ClientOnly>
    <div class="webdraw-demo">
      <div class="webdraw-demo__controls">
        <button
          v-for="action in actions"
          :key="action.label"
          @click="action.run"
        >
          {{ action.label }}
        </button>
      </div>
      <div class="webdraw-demo__stage">
        <web-draw
          :key="instanceKey"
          ref="drawing"
          @webdraw-ready="onReady"
          @webdraw-change="onChange"
          @webdraw-library-change="onLibraryChange"
          @webdraw-error="onError"
        />
      </div>
      <pre class="webdraw-demo__output">{{ output }}</pre>
    </div>
  </ClientOnly>
</template>
