// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ControlsPort } from "@untzel/skin-contract";
import { closeTop, isCodeOpen, overlayIntents, toggleCode, topLayer, type LengthTarget, type Overlay, type Panel, type UiState } from "./navigation";
import { nextOpeners, type Openers } from "./openers";
import type { LazyOverlays, ShellViews } from "./shell-views";

/** What the shell shows and who opened each layer; render reads it, navigation writes it. */
export interface NavigatorState {
  ui: UiState;
  openers: Openers<HTMLElement>;
}

export interface NavigatorOptions {
  readonly initial: UiState;
  readonly port: ControlsPort;
  readonly views: () => ShellViews;
  /** Draws the current view. */
  readonly render: () => void;
  /** Width from which the side panel replaces bottom sheets. */
  readonly desktop: MediaQueryList;
}

export interface ShellNavigator {
  readonly state: NavigatorState;
  readonly navigate: (next: Partial<UiState>) => void;
  /** False when nothing is open, so Esc falls through. */
  readonly dismiss: () => boolean;
  /** What the modal guard marks: the menu's own sheet, or the layer's sheet. */
  readonly layerRoot: (layer: Overlay | Panel) => HTMLElement | null;
  readonly toggleMenu: (via: "pointer" | "keyboard-first" | "keyboard-last") => void;
  readonly toggleCode: () => void;
  readonly openStatement: (overlay: "tempo" | "key", button: HTMLElement) => void;
  readonly openLength: (target: LengthTarget, chip: HTMLElement) => void;
  /** Crossing into or out of the desktop: an open menu closes, focus to its button. */
  readonly closeMenu: () => void;
}

type LayerSheet = { readonly root: HTMLElement; readonly heading: HTMLElement } | null;

/** The sheet a layer shows, once loaded. The menu has none: it focuses its own items. */
function layerSheet({ sheets, tracks, song }: ShellViews, layer: Overlay | Panel): LayerSheet {
  const menu = sheets.menus.current()?.sheets ?? null;
  const surfaces = { library: sheets.lazy.library.current(), share: sheets.lazy.share.current(), export: sheets.lazy.export.current(), length: sheets.picker, tempo: sheets.tempoEditor, key: sheets.keyPicker, menu: null, projects: menu?.projects ?? null, shortcuts: menu?.shortcuts ?? null, about: menu?.about ?? null, track: tracks.detail, part: song.partEditor } as const;
  return surfaces[layer];
}

/** The sheet that just opened takes the focus on its heading. */
function focusOpened(views: ShellViews, ui: UiState, previous: UiState): void {
  const opened =
    ui.overlay !== previous.overlay && ui.overlay !== null
      ? layerSheet(views, ui.overlay)
      : ui.isCodeShown && !previous.isCodeShown
        ? views.sheets.code
        : ui.panel !== previous.panel && ui.panel !== null
          ? layerSheet(views, ui.panel)
          : null;
  if (opened !== null) opened.heading.focus({ preventScroll: true });
}

function lazyOverlayOf(views: ShellViews, overlay: Overlay | null | undefined): LazyOverlays[keyof LazyOverlays] | null {
  return overlay === "library" || overlay === "export" || overlay === "share" ? views.sheets.lazy[overlay] : null;
}

/** Moves between the screens and gives the focus to what opened them. */
// Over 40 lines: the navigation closures share one state and call each other.
export function createShellNavigator({ initial, port, views, render, desktop }: NavigatorOptions): ShellNavigator {
  const state: NavigatorState = { ui: initial, openers: { overlay: null, code: null, panel: null } };
  const navigate = (next: Partial<UiState>): void => {
    const lazy = lazyOverlayOf(views(), next.overlay);
    if (lazy !== null && lazy.current() === null) return void lazy.load().then(() => navigate(next));
    const previous = state.ui;
    const active = document.activeElement;
    // The body means the opener was re-rendered away.
    const control = active instanceof HTMLElement && active !== document.body ? active : null;
    state.ui = { ...state.ui, ...next };
    state.openers = nextOpeners(state.openers, previous, state.ui, control, control !== null && views().chrome.sidePanel.root.contains(control));
    for (const intent of overlayIntents(previous.overlay, state.ui.overlay)) port[intent]();
    // A pattern preview belongs to the detail it was started from.
    if (previous.panel === "track" && (state.ui.panel !== "track" || state.ui.selectedTrack !== previous.selectedTrack)) port.endTrackPreview();
    render();
    focusOpened(views(), state.ui, previous);
  };
  const dismiss = (): boolean => {
    const { ui } = state;
    const layer = topLayer(ui);
    const next = closeTop(ui);
    if (layer === null || next === null) return false;
    const remembered = state.openers[layer];
    // A part moved while its editor was open: focus goes back to the part, not its old row.
    const partRow = layer === "panel" && ui.panel === "part" && remembered !== null && ui.selectedPart !== null
      ? views().song.list.rowFor(remembered, ui.selectedPart)
      : null;
    const opener = partRow ?? remembered;
    navigate(next);
    const isUsable = opener !== null && opener.isConnected && opener.checkVisibility() && opener.closest("[inert]") === null;
    (isUsable ? opener : views().chrome.main).focus({ preventScroll: true });
    return true;
  };
  const layerRoot = (layer: Overlay | Panel): HTMLElement | null =>
    layer === "menu" ? (views().sheets.menus.current()?.menuSheet ?? null) : (layerSheet(views(), layer)?.root ?? null);
  /** The Menu button: opens on the first item (the last with ArrowUp), or closes. */
  const toggleMenu = (via: "pointer" | "keyboard-first" | "keyboard-last"): void => {
    if (state.ui.overlay === "menu") return void dismiss();
    // Loaded right after the first paint; a tap before that waits for it.
    void views().sheets.menus.load().then((loaded) => {
      navigate({ overlay: "menu" });
      loaded.focusMenu(via === "keyboard-last" ? "last" : "first");
    });
  };
  const toggleCodePanel = (): void => {
    const wasOpen = isCodeOpen(state.ui);
    navigate(toggleCode(state.ui));
    // Closing from here keeps focus here, not on whatever opened the code first.
    if (wasOpen) views().transport.bar.code.focus({ preventScroll: true });
  };
  /** The transport's BPM or key opened its editor; on the desktop a popover by the button. */
  const openStatement = (overlay: "tempo" | "key", button: HTMLElement): void => {
    navigate({ overlay });
    const { sheets } = views();
    (overlay === "tempo" ? sheets.tempoEditor : sheets.keyPicker).anchor(desktop.matches ? button.getBoundingClientRect() : null);
  };
  /** A Length chip opened the picker; on the desktop it sits under (or above) the chip. */
  const openLength = (target: LengthTarget, chip: HTMLElement): void => {
    navigate({ overlay: "length", lengthTarget: target });
    views().sheets.picker.anchor(desktop.matches ? chip.getBoundingClientRect() : null);
  };
  const closeMenu = (): void => {
    if (state.ui.overlay !== "menu") return;
    navigate({ overlay: null });
    views().chrome.topBar.menuButton.root.focus({ preventScroll: true });
  };
  return { state, navigate, dismiss, layerRoot, toggleMenu, toggleCode: toggleCodePanel, openStatement, openLength, closeMenu };
}
