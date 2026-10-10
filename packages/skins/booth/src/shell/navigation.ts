// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Navigation state of the shell and the one rule that closes what is on top.
export type MobileTab = "tracks" | "song";
/** "part": the editor of one part of the song, song mode only. */
export type Panel = "track" | "part";
/**
 * "length": the picker of 1, 2, 4, 8 or 16 bars that a Length chip opens; "tempo" and
 * "key": the editors the transport's BPM and key open. "menu": the
 * project menu, a popover on the desktop. "projects", "shortcuts" and "about"
 * are the sheets the menu opens.
 */
export type Overlay = "library" | "share" | "export" | "length" | "tempo" | "key" | "menu" | "projects" | "shortcuts" | "about";
/** Which length the picker chooses: the loop, the selected track's pattern or the selected part. */
export type LengthTarget = "loop" | "pattern" | "part";
/** Navigation state. Lives in the shell, never in the session: it is not music. */
export interface UiState {
  readonly tab: MobileTab;
  readonly panel: Panel | null;
  /**
   * The code: no longer a tab nor a panel, opened only by Code next to Drop. It
   * lies over the panel without clearing it, so closing it shows Track or Part again.
   */
  readonly isCodeShown: boolean;
  readonly overlay: Overlay | null;
  readonly selectedTrack: string | null;
  /** The part the Part editor shows, an index into the song's parts. */
  readonly selectedPart: number | null;
  readonly lengthTarget: LengthTarget;
  /** The library adds a track (null) or changes this track's sound (Change sound). */
  readonly libraryTrack: string | null;
}
export type Layer = "overlay" | "code" | "panel";
/** The layer the person sees on top: an overlay covers the code, which covers the panel. */
export function topLayer(ui: UiState): Layer | null {
  if (ui.overlay !== null) return "overlay";
  if (ui.isCodeShown) return "code";
  if (ui.panel !== null) return "panel";
  return null;
}
/** Code is what the person sees: the code with nothing over it. */
export function isCodeOpen(ui: UiState): boolean {
  return ui.isCodeShown && ui.overlay === null;
}
/** The Code button next to Drop opens the code, and closes it when it is what shows. */
export function toggleCode(ui: UiState): Partial<UiState> {
  return { isCodeShown: !isCodeOpen(ui), overlay: null };
}
/**
 * The arrangement does not exist in loop mode: the part editor and
 * its length picker close with it; the loop's picker closes in song mode.
 */
export function withinMode(ui: UiState, mode: "loop" | "song"): UiState {
  const isSong = mode === "song";
  const panel = !isSong && ui.panel === "part" ? null : ui.panel;
  const pickerGone = ui.overlay === "length" && (isSong ? ui.lengthTarget === "loop" : ui.lengthTarget === "part");
  if (panel === ui.panel && !pickerGone) return ui;
  return { ...ui, panel, overlay: pickerGone ? null : ui.overlay };
}
export function isLengthOpen(ui: UiState, target: LengthTarget): boolean {
  return ui.overlay === "length" && ui.lengthTarget === target;
}
/** The overlays that fill the side panel on the desktop and are bottom sheets on a phone. */
const PANEL_OVERLAYS: ReadonlySet<Overlay> = new Set(["library", "share", "export", "projects", "shortcuts", "about"]);
/** Which layers show. The length picker and the menu float over the page; the others fill the panel. */
export interface ShownLayers {
  readonly panel: boolean;
  readonly picker: boolean;
  readonly tempo: boolean;
  readonly key: boolean;
  readonly menu: boolean;
  readonly track: boolean;
  readonly part: boolean;
  readonly code: boolean;
  readonly library: boolean;
  readonly share: boolean;
  readonly export: boolean;
  readonly projects: boolean;
  readonly shortcuts: boolean;
  readonly about: boolean;
}
export function shownLayers(ui: UiState): ShownLayers {
  const panelOverlay = ui.overlay !== null && PANEL_OVERLAYS.has(ui.overlay);
  const inPanel = (panel: Panel): boolean => ui.panel === panel && !ui.isCodeShown && !panelOverlay;
  return {
    panel: ui.panel !== null || ui.isCodeShown || panelOverlay,
    picker: ui.overlay === "length",
    tempo: ui.overlay === "tempo",
    key: ui.overlay === "key",
    menu: ui.overlay === "menu",
    track: inPanel("track"),
    part: inPanel("part"),
    code: ui.isCodeShown && !panelOverlay,
    library: ui.overlay === "library",
    share: ui.overlay === "share",
    export: ui.overlay === "export",
    projects: ui.overlay === "projects",
    shortcuts: ui.overlay === "shortcuts",
    about: ui.overlay === "about",
  };
}
/**
 * What closing the top layer changes. Every close control (a sheet's ×, the side panel's
 * ×, Esc, the backdrop) goes through here.
 */
export function closeTop(ui: UiState): Partial<UiState> | null {
  switch (topLayer(ui)) {
    case "overlay":
      return { overlay: null };
    case "code":
      return { isCodeShown: false };
    case "panel":
      return { panel: null };
    case null:
      return null;
  }
}
/**
 * The port intents an overlay change calls: Share builds its link when opened; Export only
 * shows its choices (nothing renders until Render). Both stop when left. Leaving
 * the library ends what it plays; leaving the tempo or key editor closes its undo step
 * (several + in a row are one step).
 */
export type OverlayIntent = "prepareShare" | "closeShare" | "openExport" | "closeExport" | "stopPreview" | "endTrackPreview" | "endGesture";
export function overlayIntents(previous: Overlay | null, next: Overlay | null): readonly OverlayIntent[] {
  if (previous === next) return [];
  const intents: OverlayIntent[] = [];
  if (previous === "share") intents.push("closeShare");
  if (previous === "export") intents.push("closeExport");
  if (previous === "library") intents.push("stopPreview", "endTrackPreview");
  if (previous === "tempo" || previous === "key") intents.push("endGesture");
  if (next === "share") intents.push("prepareShare");
  if (next === "export") intents.push("openExport");
  return intents;
}
