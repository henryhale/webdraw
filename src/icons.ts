import { svg, type TemplateResult } from "lit";

export type IconName = "hand" | "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "eraser" | "frame" | "image" | "embeddable" | "stickynote" | "laser" | "bucket" | "menu" | "library" | "undo" | "redo" | "help" | "more" | "search" | "export" | "close" | "lock" | "duplicate" | "delete" | "link" | "sendBack" | "sendBackward" | "bringForward" | "bringFront";

const svgIcon = (body: TemplateResult) => svg`
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </svg>`;

export const icon = (name: IconName) => {
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
    case "stickynote": return svgIcon(svg`<path d="M6 4h12a2 2 0 0 1 2 2v9l-5 5H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M14 20v-4a2 2 0 0 1 2-2h4M8 9h8M8 13h5"/>`);
    case "laser": return svgIcon(svg`<path d="m5 19 14-14M8 5l1-3m5 4 3-1m2 5 3 1M5 14l-3 1"/>`);
    case "bucket": return svgIcon(svg`<path d="m5 12 7-7 7 7-7 7-7-7Z"/><path d="m8 9 7 7M18 18c0-1 1-2 2-3 1 1 2 2 2 3a2 2 0 0 1-4 0Z"/>`);
    case "menu": return svgIcon(svg`<path d="M4 6h16M4 12h16M4 18h16"/>`);
    case "library": return svgIcon(svg`<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13"/>`);
    case "undo": return svgIcon(svg`<path d="M9 13 5 9l4-4M5 9h11a4 4 0 0 1 0 8h-2"/>`);
    case "redo": return svgIcon(svg`<path d="m15 13 4-4-4-4m4 4H8a4 4 0 0 0 0 8h2"/>`);
    case "help": return svgIcon(svg`<circle cx="12" cy="12" r="9"/><path d="M12 17v.01M12 14a2 2 0 0 1 1.3-1.9A3 3 0 1 0 9 9"/>`);
    case "more": return svgIcon(svg`<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>`);
    case "search": return svgIcon(svg`<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>`);
    case "export": return svgIcon(svg`<path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/>`);
    case "close": return svgIcon(svg`<path d="m6 6 12 12M18 6 6 18"/>`);
    case "lock": return svgIcon(svg`<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3"/>`);
    case "duplicate": return svgIcon(svg`<rect x="7" y="7" width="12" height="12" rx="2"/><path d="M15 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`);
    case "delete": return svgIcon(svg`<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>`);
    case "link": return svgIcon(svg`<path d="m9 15 6-6m-8 9H6a4 4 0 0 1 0-8h3m6 0h3a4 4 0 0 1 0 8h-3"/>`);
    case "sendBack": return svgIcon(svg`<path d="M12 4v13m-4-4 4 4 4-4M5 21h14"/>`);
    case "sendBackward": return svgIcon(svg`<path d="M12 4v14m-4-4 4 4 4-4"/>`);
    case "bringForward": return svgIcon(svg`<path d="M12 20V6m-4 4 4-4 4 4"/>`);
    case "bringFront": return svgIcon(svg`<path d="M12 20V7m-4 4 4-4 4 4M5 3h14"/>`);
  }
};

export const sloppinessIcon = (value: number) => svgIcon(value === 0
  ? svg`<path d="m4 15 5-2 5-4 6-2"/>`
  : value === 1
    ? svg`<path d="m4 15 5-2 3-4 2 5 6-3"/>`
    : svg`<path d="m4 15 5-2 3-4 1 6 3-5 4 2"/><path d="m5 17 5-2 4-4 2 3 4-2"/>`);
