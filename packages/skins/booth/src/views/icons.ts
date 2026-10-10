// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Drawn SVG icons: 2 px stroke, round caps, 24 × 24 box, paths centred on (12, 12).

export type IconName =
  | "code"
  | "share"
  | "export"
  | "close"
  | "play"
  | "pause"
  | "stop"
  | "drop"
  | "plus"
  | "minus"
  | "tune"
  | "tracks"
  | "song"
  | "chevron"
  | "back"
  | "forward"
  | "search"
  | "level"
  | "undo"
  | "redo"
  | "pencil"
  | "swap"
  | "speaker"
  | "target"
  | "alert"
  | "link"
  | "check"
  | "blank"
  | "brackets"
  | "play-from"
  | "play-part"
  | "starter-kick"
  | "starter-bass"
  | "starter-hats"
  | "starter-chords"
  | "menu"
  | "folder"
  | "duplicate"
  | "save-file"
  | "open-file"
  | "trash"
  | "globe"
  | "motion"
  | "book"
  | "keyboard"
  | "info"
  | "external";

const SVG = "http://www.w3.org/2000/svg";

const PATHS: Readonly<Record<IconName, readonly IconPart[]>> = {
  code: [{ d: "M7 6 L1 12 L7 18 M17 6 L23 12 L17 18", role: "stroke" }],
  share: [{ d: "M12 18 V2 M6 8 L12 2 L18 8 M4 14 V22 H20 V14", role: "stroke" }],
  // A frame with an arrow leaving by its corner: the file goes out (not a recorder).
  export: [{ d: "M14 3 H21 V10 M21 3 L11 13 M18 14 V21 H3 V6 H10", role: "stroke" }],
  close: [{ d: "M5 5 L19 19 M19 5 L5 19", role: "stroke" }],
  play: [{ d: "M6 3 L21 12 L6 21 Z", role: "fill" }],
  pause: [{ d: "M7 4 V20 M17 4 V20", role: "stroke" }],
  stop: [{ d: "M6 6 H18 V18 H6 Z", role: "fill" }],
  drop: [{ d: "M12 3 V20 M5 13 L12 20 L19 13", role: "stroke" }],
  plus: [{ d: "M12 4 V20 M4 12 H20", role: "stroke" }],
  minus: [{ d: "M4 12 H20", role: "stroke" }],
  tune: [
    { d: "M3 6 H21 M3 18 H21", role: "stroke" },
    { d: "M9 3 A3 3 0 1 1 8.99 3 Z M16 15 A3 3 0 1 1 15.99 15 Z", role: "knob" },
  ],
  tracks: [{ d: "M3 3 h7 v7 h-7 Z M14 3 h7 v7 h-7 Z M3 14 h7 v7 h-7 Z M14 14 h7 v7 h-7 Z", role: "stroke" }],
  song: [{ d: "M2 6 h6 M10 6 h12 M2 13 h10 M15 13 h7 M2 20 h4 M9 20 h13", role: "stroke" }],
  // Points down (hide the controls); the stylesheet turns it up when they are hidden.
  chevron: [{ d: "M5 9 L12 16 L19 9", role: "stroke" }],
  // Previous and next bar in the track detail.
  back: [{ d: "M15 5 L8 12 L15 19", role: "stroke" }],
  forward: [{ d: "M9 5 L16 12 L9 19", role: "stroke" }],
  search: [{ d: "M10 4 A6 6 0 1 1 9.99 4 Z M14.5 14.5 L20 20", role: "stroke" }],
  // Three level bars of the audition.
  level: [
    { d: "M5 15 h3 v5 h-3 Z", role: "fill" },
    { d: "M10.5 8 h3 v12 h-3 Z", role: "fill" },
    { d: "M16 12 h3 v8 h-3 Z", role: "fill" },
  ],
  // Track controls.
  undo: [{ d: "M9 14 L4 9 L9 4 M4 9 H15 A5 5 0 0 1 15 19 H11", role: "stroke" }],
  redo: [{ d: "M15 14 L20 9 L15 4 M20 9 H9 A5 5 0 0 0 9 19 H13", role: "stroke" }],
  pencil: [{ d: "M4 20 L5 15 L16 4 L20 8 L9 19 Z M13.5 6.5 L17.5 10.5", role: "stroke" }],
  swap: [{ d: "M4 8 H19 M15 4 L19 8 L15 12 M20 16 H5 M9 12 L5 16 L9 20", role: "stroke" }],
  speaker: [{ d: "M4 9 H8 L13 5 V19 L8 15 H4 Z M16.5 9 A4 4 0 0 1 16.5 15 M19 6.5 A7.5 7.5 0 0 1 19 17.5", role: "stroke" }],
  target: [{ d: "M12 5 A7 7 0 1 1 11.99 5 Z M12 1 V5 M12 19 V23 M1 12 H5 M19 12 H23", role: "stroke" }],
  alert: [{ d: "M12 3 A9 9 0 1 1 11.99 3 Z M12 7.5 V13 M12 16.5 V16.6", role: "stroke" }],
  link: [{ d: "M10 14 L14 10 M8.5 11.5 L6 14 A3 3 0 0 0 10 18 L12.5 15.5 M15.5 12.5 L18 10 A3 3 0 0 0 14 6 L11.5 8.5", role: "stroke" }],
  check: [{ d: "M5 12.5 L10 17.5 L19 7", role: "stroke" }],
  // The empty state's starters: a drum head, a low wave, cymbal strokes, stacked notes.
  // The play range: a bracket pair, "play from here" (a bar line and a play), and a
  // part's Play (a play inside the bracket pair: that part only).
  brackets: [{ d: "M9 4 H5 V20 H9 M15 4 H19 V20 H15", role: "stroke" }],
  "play-from": [{ d: "M4 4 V20 M9 5 L20 12 L9 19 Z", role: "stroke" }],
  "play-part": [{ d: "M7 4 H3 V20 H7 M17 4 H21 V20 H17 M9.5 8 L15.5 12 L9.5 16 Z", role: "stroke" }],
  "starter-kick": [{ d: "M12 4 A8 8 0 1 1 11.99 4 Z M12 9 A3 3 0 1 1 11.99 9 Z", role: "stroke" }],
  "starter-bass": [{ d: "M2 12 C5 4 8 4 11 12 S17 20 22 12", role: "stroke" }],
  "starter-hats": [{ d: "M4 9 H20 M6 14 H18 M12 9 V21 M9 21 H15", role: "stroke" }],
  "starter-chords": [{ d: "M6 6 H18 M6 12 H18 M6 18 H18 M9 4 V8 M15 10 V14 M11 16 V20", role: "stroke" }],
  blank: [{ d: "M4 4 H8 M10 4 H14 M16 4 H20 V8 M20 10 V14 M20 16 V20 H16 M14 20 H10 M8 20 H4 V16 M4 14 V10 M4 8 V4 M12 8.5 V15.5 M8.5 12 H15.5", role: "stroke" }],
  // The project menu.
  menu: [{ d: "M4 6 H20 M4 12 H20 M4 18 H20", role: "stroke" }],
  folder: [{ d: "M2.5 6.5 A1.5 1.5 0 0 1 4 5 H9.5 L12 7.5 H20 A1.5 1.5 0 0 1 21.5 9 V17.5 A1.5 1.5 0 0 1 20 19 H4 A1.5 1.5 0 0 1 2.5 17.5 Z", role: "stroke" }],
  duplicate: [{ d: "M8 8 H20 V20 H8 Z M4 16 V5.5 A1.5 1.5 0 0 1 5.5 4 H16", role: "stroke" }],
  "save-file": [{ d: "M12 3 V15 M6.5 9.5 L12 15 L17.5 9.5 M4 17 V21 H20 V17", role: "stroke" }],
  "open-file": [{ d: "M14 2.5 H6 V21.5 H18 V6.5 Z M14 2.5 V6.5 H18 M12 18 V11.5 M9 14.5 L12 11.5 L15 14.5", role: "stroke" }],
  trash: [{ d: "M4 6.5 H20 M9.5 6.5 V3.5 H14.5 V6.5 M6 6.5 L7.2 20.5 H16.8 L18 6.5 M10 10.5 V16.5 M14 10.5 V16.5", role: "stroke" }],
  globe: [{ d: "M12 2.5 A9.5 9.5 0 1 1 11.99 2.5 Z M2.5 12 H21.5 M12 2.5 C14.9 5.1 16 8.4 16 12 S14.9 18.9 12 21.5 C9.1 18.9 8 15.6 8 12 S9.1 5.1 12 2.5 Z", role: "stroke" }],
  motion: [{ d: "M12 9 A3 3 0 1 1 11.99 9 Z M12 3 A9 9 0 0 1 21 12 M12 21 A9 9 0 0 1 3 12", role: "stroke" }],
  book: [{ d: "M2.5 5 H9 A3 3 0 0 1 12 8 V20.5 A2.5 2.5 0 0 0 9.5 18 H2.5 Z M21.5 5 H15 A3 3 0 0 0 12 8 V20.5 A2.5 2.5 0 0 1 14.5 18 H21.5 Z", role: "stroke" }],
  keyboard: [{ d: "M2 6 H22 V18 H2 Z M6 10 H7 M11.5 10 H12.5 M17 10 H18 M7 14 H17", role: "stroke" }],
  info: [{ d: "M12 2.5 A9.5 9.5 0 1 1 11.99 2.5 Z M12 11 V17 M12 7.5 V7.6", role: "stroke" }],
  external: [{ d: "M10 5 H5 V19 H19 V14 M14 4 H20 V10 M20 4 L11 13", role: "stroke" }],
};

export type IconPart = { readonly d: string; readonly role: "stroke" | "fill" | "knob" };

export function icon(name: IconName): SVGSVGElement {
  return drawIcon(name, PATHS[name]);
}

/** The drawing of an icon from its parts. */
function drawIcon(name: string, parts: readonly IconPart[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("ui-icon", `ui-icon--${name}`);
  for (const part of parts) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", part.d);
    path.classList.add(`ui-icon__${part.role}`);
    svg.append(path);
  }
  return svg;
}
