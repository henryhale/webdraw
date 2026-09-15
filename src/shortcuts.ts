export type ShortcutItem = {
  label: string;
  bindings: readonly (readonly string[])[];
};

export type ShortcutGroup = {
  title: string;
  items: readonly ShortcutItem[];
};

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: "Tools",
    items: [
      { label: "Hand (panning tool)", bindings: [["H"]] },
      { label: "Selection", bindings: [["V"], ["1"]] },
      { label: "Rectangle", bindings: [["R"], ["2"]] },
      { label: "Diamond", bindings: [["D"], ["3"]] },
      { label: "Ellipse", bindings: [["O"], ["4"]] },
      { label: "Arrow", bindings: [["A"], ["5"]] },
      { label: "Line", bindings: [["L"], ["6"]] },
      { label: "Draw", bindings: [["P"], ["7"]] },
      { label: "Text", bindings: [["T"], ["8"]] },
      { label: "Sticky note", bindings: [["N"]] },
      { label: "Insert image", bindings: [["9"]] },
      { label: "Eraser", bindings: [["E"], ["0"]] },
      { label: "Frame tool", bindings: [["F"]] },
      { label: "Laser pointer", bindings: [["K"]] },
      { label: "Bucket fill", bindings: [["B"]] },
      {
        label: "Pick color from canvas",
        bindings: [["I"], ["Shift", "S"], ["Shift", "G"]],
      },
      { label: "Edit line/arrow points", bindings: [["Ctrl", "Enter"]] },
      { label: "Edit text / add label", bindings: [["Enter"]] },
      {
        label: "Add new line (text editor)",
        bindings: [["Enter"], ["Shift", "Enter"]],
      },
      {
        label: "Finish editing (text editor)",
        bindings: [["Esc"], ["Ctrl", "Enter"]],
      },
      { label: "Curved arrow", bindings: [["A", "click", "click", "click"]] },
      { label: "Curved line", bindings: [["L", "click", "click", "click"]] },
      { label: "Crop image", bindings: [["double-click"], ["Enter"]] },
      { label: "Finish image cropping", bindings: [["Enter"], ["Esc"]] },
      { label: "Keep selected tool active after drawing", bindings: [["Q"]] },
      { label: "Prevent arrow binding", bindings: [["Ctrl"]] },
      {
        label: "Add / Update link for selected shape",
        bindings: [["Ctrl", "K"]],
      },
      { label: "Toggle shape type", bindings: [["Tab"], ["Shift", "Tab"]] },
    ],
  },
  {
    title: "View",
    items: [
      { label: "Zoom in", bindings: [["Ctrl", "+"]] },
      { label: "Zoom out", bindings: [["Ctrl", "−"]] },
      { label: "Reset zoom", bindings: [["Ctrl", "0"]] },
      { label: "Zoom to fit all elements", bindings: [["Shift", "1"]] },
      { label: "Zoom to selection", bindings: [["Shift", "2"]] },
      { label: "Move page up/down", bindings: [["PgUp/PgDn"]] },
      { label: "Move page left/right", bindings: [["Shift", "PgUp/PgDn"]] },
      { label: "Zen mode", bindings: [["Alt", "Z"]] },
      { label: "Snap to objects", bindings: [["Alt", "S"]] },
      { label: "Toggle grid", bindings: [["Ctrl", "'"]] },
      { label: "View mode", bindings: [["Alt", "R"]] },
      { label: "Toggle light/dark theme", bindings: [["Alt", "Shift", "D"]] },
      { label: "Canvas & Shape properties", bindings: [["Alt", "/"]] },
      { label: "Find on canvas", bindings: [["Ctrl", "F"]] },
      { label: "Command palette", bindings: [["Ctrl", "/"]] },
      { label: "Export image", bindings: [["Ctrl", "Shift", "E"]] },
      { label: "Keyboard shortcuts", bindings: [["?"]] },
    ],
  },
  {
    title: "Editor",
    items: [
      {
        label: "Create flowchart from generic element",
        bindings: [["Ctrl", "Arrow Key"]],
      },
      { label: "Navigate a flowchart", bindings: [["Alt", "Arrow Key"]] },
      {
        label: "Move canvas",
        bindings: [
          ["Space", "drag"],
          ["Wheel", "drag"],
        ],
      },
      { label: "Reset the canvas", bindings: [["Ctrl", "Delete"]] },
      { label: "Delete", bindings: [["Delete"]] },
      { label: "Cut", bindings: [["Ctrl", "X"]] },
      { label: "Copy", bindings: [["Ctrl", "C"]] },
      { label: "Paste", bindings: [["Ctrl", "V"]] },
      { label: "Paste as plaintext", bindings: [["Ctrl", "Shift", "V"]] },
      { label: "Select all", bindings: [["Ctrl", "A"]] },
      { label: "Add element to selection", bindings: [["Shift", "click"]] },
      { label: "Deep select", bindings: [["Ctrl", "click"]] },
      {
        label: "Deep select within box, prevent dragging",
        bindings: [["Ctrl", "drag"]],
      },
      { label: "Copy to clipboard as PNG", bindings: [["Shift", "Alt", "C"]] },
      { label: "Copy styles", bindings: [["Ctrl", "Alt", "C"]] },
      { label: "Paste styles", bindings: [["Ctrl", "Alt", "V"]] },
      { label: "Send to back", bindings: [["Ctrl", "Shift", "["]] },
      { label: "Bring to front", bindings: [["Ctrl", "Shift", "]"]] },
      { label: "Send backward", bindings: [["Ctrl", "["]] },
      { label: "Bring forward", bindings: [["Ctrl", "]"]] },
      { label: "Align top", bindings: [["Ctrl", "Shift", "↑"]] },
      { label: "Align bottom", bindings: [["Ctrl", "Shift", "↓"]] },
      { label: "Align left", bindings: [["Ctrl", "Shift", "←"]] },
      { label: "Align right", bindings: [["Ctrl", "Shift", "→"]] },
      {
        label: "Duplicate",
        bindings: [
          ["Ctrl", "D"],
          ["Alt", "drag"],
        ],
      },
      { label: "Lock/unlock selection", bindings: [["Ctrl", "Shift", "L"]] },
      { label: "Undo", bindings: [["Ctrl", "Z"]] },
      { label: "Redo", bindings: [["Ctrl", "Shift", "Z"]] },
      { label: "Group selection", bindings: [["Ctrl", "G"]] },
      { label: "Ungroup selection", bindings: [["Ctrl", "Shift", "G"]] },
      { label: "Flip horizontal", bindings: [["Shift", "H"]] },
      { label: "Flip vertical", bindings: [["Shift", "V"]] },
      { label: "Show stroke color picker", bindings: [["S"]] },
      { label: "Show background color picker", bindings: [["G"]] },
      { label: "Show font picker", bindings: [["Shift", "F"]] },
      { label: "Decrease font size", bindings: [["Ctrl", "Shift", "<"]] },
      { label: "Increase font size", bindings: [["Ctrl", "Shift", ">"]] },
    ],
  },
];

export const shortcutFor = (label: string) =>
  SHORTCUT_GROUPS.flatMap((group) => group.items)
    .find((item) => item.label === label)
    ?.bindings[0].join("+") ?? "";

if (import.meta.env.DEV)
  console.assert(shortcutFor("Export image") === "Ctrl+Shift+E");
