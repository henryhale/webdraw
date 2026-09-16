import { svg, type TemplateResult } from "lit";

export type IconName =
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
  | "bucket"
  | "menu"
  | "library"
  | "undo"
  | "redo"
  | "help"
  | "more"
  | "search"
  | "export"
  | "close"
  | "lock"
  | "duplicate"
  | "delete"
  | "link"
  | "sendBack"
  | "sendBackward"
  | "bringForward"
  | "bringFront"
  | "open"
  | "save"
  | "command"
  | "preferences"
  | "sun"
  | "moon"
  | "monitor"
  | "chevron";

const svgIcon = (body: TemplateResult) => svg`
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </svg>`;

export const icon = (name: IconName) => {
  switch (name) {
    case "hand":
      return svgIcon(
        svg`<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 5.5v-2a1.5 1.5 0 1 1 3 0V12M14 5.5a1.5 1.5 0 0 1 3 0V12M17 7.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.8-2.7L3.7 13.3a1.5 1.5 0 0 1 2.8-1.7L8 13Z"/>`,
      );
    case "selection":
      return svgIcon(
        svg`<path d="m6 6 4.15 11.8c.1.27.48.28.67 0L13 13l4.79-2c.28-.12.28-.52 0-.64L6 6Zm7.5 7.5L18 18"/>`,
      );
    case "rectangle":
      return svgIcon(svg`<rect x="4" y="4" width="16" height="16" rx="2"/>`);
    case "diamond":
      return svgIcon(
        svg`<path d="m10.5 20.4-6.9-6.9a2.2 2.2 0 0 1 0-3l6.9-6.9a2.2 2.2 0 0 1 3 0l6.9 6.9a2.2 2.2 0 0 1 0 3l-6.9 6.9a2.2 2.2 0 0 1-3 0Z"/>`,
      );
    case "ellipse":
      return svgIcon(svg`<circle cx="12" cy="12" r="9"/>`);
    case "arrow":
      return svgIcon(svg`<path d="M5 12h14m-4-4 4 4-4 4"/>`);
    case "line":
      return svgIcon(svg`<path d="M5 12h14"/>`);
    case "freedraw":
      return svgIcon(
        svg`<path d="m7.6 18.7 9.3-9.3a2.8 2.8 0 0 0-4-4l-9.3 9.3A4 4 0 0 0 2.5 17.5v2h2a4 4 0 0 0 3.1-.8ZM12 6.5l4 4"/>`,
      );
    case "text":
      return svgIcon(
        svg`<path d="M4 20h3m7 0h7M7 15h7M10 6h6L6 20m6-16 8 16"/>`,
      );
    case "eraser":
      return svgIcon(
        svg`<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20M18 13.3 11.7 7"/>`,
      );
    case "frame":
      return svgIcon(svg`<path d="M7 3H3v4M17 3h4v4M21 17v4h-4M7 21H3v-4"/>`);
    case "image":
      return svgIcon(
        svg`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/>`,
      );
    case "embeddable":
      return svgIcon(
        svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9-3 3 3 3m4-6 3 3-3 3"/>`,
      );
    case "stickynote":
      return svgIcon(
        svg`<path d="M6 4h12a2 2 0 0 1 2 2v9l-5 5H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M14 20v-4a2 2 0 0 1 2-2h4M8 9h8M8 13h5"/>`,
      );
    case "laser":
      return svgIcon(
        svg`<path d="m5 19 14-14M8 5l1-3m5 4 3-1m2 5 3 1M5 14l-3 1"/>`,
      );
    case "bucket":
      return svgIcon(
        svg`<path d="m5 12 7-7 7 7-7 7-7-7Z"/><path d="m8 9 7 7M18 18c0-1 1-2 2-3 1 1 2 2 2 3a2 2 0 0 1-4 0Z"/>`,
      );
    case "menu":
      return svgIcon(svg`<path d="M4 6h16M4 12h16M4 18h16"/>`);
    case "library":
      return svgIcon(
        svg`<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13"/>`,
      );
    case "undo":
      return svgIcon(svg`<path d="M9 13 5 9l4-4M5 9h11a4 4 0 0 1 0 8h-2"/>`);
    case "redo":
      return svgIcon(svg`<path d="m15 13 4-4-4-4m4 4H8a4 4 0 0 0 0 8h2"/>`);
    case "help":
      return svgIcon(
        svg`<circle cx="12" cy="12" r="9"/><path d="M12 17v.01M12 14a2 2 0 0 1 1.3-1.9A3 3 0 1 0 9 9"/>`,
      );
    case "more":
      return svgIcon(
        svg`<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>`,
      );
    case "search":
      return svgIcon(
        svg`<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>`,
      );
    case "export":
      return svgIcon(svg`<path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/>`);
    case "close":
      return svgIcon(svg`<path d="m6 6 12 12M18 6 6 18"/>`);
    case "lock":
      return svgIcon(
        svg`<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3"/>`,
      );
    case "duplicate":
      return svgIcon(
        svg`<rect x="7" y="7" width="12" height="12" rx="2"/><path d="M15 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`,
      );
    case "delete":
      return svgIcon(
        svg`<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>`,
      );
    case "link":
      return svgIcon(
        svg`<path d="m9 15 6-6m-8 9H6a4 4 0 0 1 0-8h3m6 0h3a4 4 0 0 1 0 8h-3"/>`,
      );
    case "sendBack":
      return svgIcon(svg`<path d="M12 4v13m-4-4 4 4 4-4M5 21h14"/>`);
    case "sendBackward":
      return svgIcon(svg`<path d="M12 4v14m-4-4 4 4 4-4"/>`);
    case "bringForward":
      return svgIcon(svg`<path d="M12 20V6m-4 4 4-4 4 4"/>`);
    case "bringFront":
      return svgIcon(svg`<path d="M12 20V7m-4 4 4-4 4 4M5 3h14"/>`);
    case "open":
      return svgIcon(
        svg`<path d="M3 19V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z"/>`,
      );
    case "save":
      return svgIcon(svg`<path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/>`);
    case "command":
      return svgIcon(svg`<path d="m13 2-9 12h7l-1 8 10-13h-7V2Z"/>`);
    case "preferences":
      return svgIcon(
        svg`<path d="M4 6h8m4 0h4M4 12h3m4 0h9M4 18h10m4 0h2"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>`,
      );
    case "sun":
      return svgIcon(
        svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
      );
    case "moon":
      return svgIcon(
        svg`<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>`,
      );
    case "monitor":
      return svgIcon(
        svg`<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/>`,
      );
    case "chevron":
      return svgIcon(svg`<path d="m9 6 6 6-6 6"/>`);
  }
};

export const sloppinessIcon = (value: number) =>
  svgIcon(
    value === 0
      ? svg`<path d="m4 15 5-2 5-4 6-2"/>`
      : value === 1
        ? svg`<path d="m4 15 5-2 3-4 2 5 6-3"/>`
        : svg`<path d="m4 15 5-2 3-4 1 6 3-5 4 2"/><path d="m5 17 5-2 4-4 2 3 4-2"/>`,
  );

export const edgeIcon = (round: boolean) =>
  round
    ? svg`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12V8a4 4 0 0 1 4-4h4"/>
      <path d="M16 4h.01M20 4h.01M20 8h.01M20 12h.01M4 16h.01M20 16h.01M4 20h.01M8 20h.01M12 20h.01M16 20h.01M20 20h.01"/>
    </svg>`
    : svg`<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.333 10V3.333H10"/>
      <path d="M13.333 3.333h.01M16.667 3.333h.01M16.667 6.667h.01M16.667 10h.01M3.333 13.333h.01M16.667 13.333h.01M3.333 16.667h.01M6.667 16.667h.01M10 16.667h.01M13.333 16.667h.01M16.667 16.667h.01"/>
    </svg>`;

export const logoIcon = svg`<svg aria-hidden="true" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#2f9e44"/>
    <path d="M13 18l9 28 10-20 10 20 9-28" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="13" cy="18" r="3" fill="#b2f2bb"/>
    <circle cx="51" cy="18" r="3" fill="#b2f2bb"/>
  </svg>`;
