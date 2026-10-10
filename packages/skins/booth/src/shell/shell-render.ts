// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { UntzelView } from "@untzel/presentation/view-model";
import { isFocusLost } from "../behavior/focus/focus-containment";
import type { ControlsPort } from "@untzel/skin-contract";
import { layerModality } from "./layer-modality";
import { isCodeOpen, isLengthOpen, shownLayers, withinMode, type LengthTarget, type Overlay, type Panel, type ShownLayers } from "./navigation";
import { focusAfterStart } from "../behavior/focus/start-focus";
import { lengthChoice } from "../views/song-settings/length-choices";
import { appAttributes } from "./app-attributes";
import type { NavigatorState } from "./shell-navigator";
import type { ShellViews } from "./shell-views";

export interface ShellRenderOptions {
  readonly views: ShellViews;
  readonly state: NavigatorState;
  readonly port: ControlsPort;
  readonly layerRoot: (layer: Overlay | Panel) => HTMLElement | null;
  readonly isCollapsed: () => boolean;
  /** Width from which the side panel replaces bottom sheets. */
  readonly desktop: MediaQueryList;
  /** Sharing a link: from 1280 px the Share sheet copies the link instead of opening the system sheet. */
  readonly copyFirst: MediaQueryList;
  readonly close: () => void;
  /** Mounts the code editor (@untzel/editor) the first time Code opens. */
  readonly mountEditor: (host: HTMLElement) => void;
}

/** Draws a view onto every screen, in the shell's statement order. */
// Over 40 lines: its three steps, each under 40, share the views and the run-once flags.
export function createShellRender(options: ShellRenderOptions): (view: UntzelView) => void {
  const { views, state } = options;
  const { transport, tracks, song, sheets, chrome } = views;
  let editorMounted = false;
  let wasRunning = false;
  // The menu and the sheets load once the music runs: before the tap, the network is the
  // first screen's and the engine's. Opening one earlier loads it then.
  let isPrefetched = false;
  const prefetchOverlays = (): void => {
    isPrefetched = true;
    void sheets.menus.load();
    for (const sheet of Object.values(sheets.lazy)) void sheet.load();
  };
  const lengthOpen = (target: LengthTarget): boolean => isLengthOpen(state.ui, target);

  /** What every phase draws: the app's attributes, the top bar, the menu and the layers. */
  const renderLayers = (view: UntzelView, isDesktop: boolean, isRunning: boolean): ShownLayers => {
    const collapsed = options.isCollapsed();
    const attributes = appAttributes({ ui: state.ui, phase: view.phase, mode: view.transport.mode, isDesktop, isCollapsed: collapsed });
    for (const [name, value] of Object.entries(attributes)) chrome.app.dataset[name] = value;
    chrome.idle.update(view);
    const shown = shownLayers(state.ui);
    chrome.topBar.update(view, shown.menu);
    // Before the "no music" return: the menu and its sheets work on the waiting screen too.
    sheets.menus.current()?.update(view, shown, isDesktop);
    // Before any focus move: dismiss() checks the opener is outside [inert].
    const modality = layerModality(state.ui, { isDesktop, isRunning });
    chrome.guard.update({ root: modality.target === null ? null : options.layerRoot(modality.target), trapsTab: modality.trapsTab, isRunning });
    chrome.tabBar.root.hidden = isRunning && collapsed;
    chrome.editing.hidden = collapsed;
    transport.bar.setLayout({ isCodeOpen: isCodeOpen(state.ui), isCollapsed: collapsed, isLengthOpen: lengthOpen("loop") });
    chrome.tabBar.update(state.ui.tab);
    chrome.sidePanel.update(state.ui.isCodeShown ? null : state.ui.panel, isRunning && view.transport.mode === "song");
    const isMenuSheet = shown.projects || shown.shortcuts || shown.about;
    chrome.sidePanel.root.hidden = !shown.panel || !(isRunning || isMenuSheet);
    sheets.picker.root.hidden = !isRunning || !shown.picker;
    sheets.tempoEditor.root.hidden = !isRunning || !shown.tempo;
    sheets.keyPicker.root.hidden = !isRunning || !shown.key;
    transport.bar.tempoKey.setOpen(shown.tempo ? "tempo" : shown.key ? "key" : null);
    return shown;
  };

  /** The running music's first frames: the sheets load, the empty state, the start focus. */
  const renderStart = (view: UntzelView): void => {
    if (!isPrefetched) prefetchOverlays();
    const isEmpty = view.tracks.length === 0;
    chrome.app.dataset["empty"] = String(isEmpty);
    tracks.empty.update(view.starters, isEmpty);
    // The waiting screen hid with the control that started the music.
    const startFocus = wasRunning ? null : focusAfterStart(isEmpty, isFocusLost(document, chrome.main));
    if (startFocus !== null) window.requestAnimationFrame(() => (startFocus === "play" ? transport.bar.play : tracks.empty.addTrack).focus({ preventScroll: true }));
    wasRunning = true;
  };

  /** The running music: every view's update, then the sheets shown or hidden. */
  const renderMusic = (view: UntzelView, isDesktop: boolean, shown: ShownLayers): void => {
    transport.history.update(view.history);
    sheets.codeHistory.update(view.history);
    sheets.tempoEditor.update(view.transport);
    sheets.keyPicker.update(view.transport);
    tracks.grid.update(view);
    tracks.table.update(view, state.ui.panel === "track" ? state.ui.selectedTrack : null);
    const openPart = state.ui.panel === "part" ? (state.ui.selectedPart ?? view.song.currentPart ?? 0) : null;
    song.list.update(view, openPart);
    tracks.detail.update(view, state.ui.selectedTrack ?? view.tracks[0]?.name ?? null, isDesktop, lengthOpen("pattern"));
    song.partEditor.update(view, state.ui.selectedPart ?? view.song.currentPart ?? 0, lengthOpen("part"));
    sheets.picker.update(state.ui.overlay === "length" ? lengthChoice(view, { target: state.ui.lengthTarget, track: state.ui.selectedTrack, part: state.ui.selectedPart }, options.port, options.close) : null);
    sheets.code.update(view.transport);
    const libraryTrack = state.ui.libraryTrack === null ? null : (view.tracks.find((track) => track.name === state.ui.libraryTrack) ?? null);
    sheets.lazy.library.render(shown.library, (sheet) => sheet.update(view, libraryTrack));
    sheets.lazy.share.render(shown.share, (sheet) => sheet.update(view, options.copyFirst.matches));
    sheets.lazy.export.render(shown.export, (sheet) => sheet.update(view));
    tracks.detail.root.hidden = !shown.track;
    transport.bar.update(view.transport, view.playRange, shown.track ? tracks.detail.editing() : null);
    song.partEditor.root.hidden = !shown.part;
    sheets.code.root.hidden = !shown.code;
    if (state.ui.isCodeShown && !editorMounted) {
      editorMounted = true;
      options.mountEditor(sheets.code.editorHost);
    }
  };

  return (view) => {
    const isDesktop = options.desktop.matches;
    const isRunning = view.phase === "running";
    if (!isRunning) wasRunning = false;
    if (isRunning) state.ui = withinMode(state.ui, view.transport.mode);
    const shown = renderLayers(view, isDesktop, isRunning);
    if (!isRunning) return;
    renderStart(view);
    renderMusic(view, isDesktop, shown);
  };
}
