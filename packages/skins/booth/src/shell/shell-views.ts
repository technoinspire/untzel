// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Translator } from "@untzel/i18n";
import type { LocaleStore } from "@untzel/i18n/dom";
import type { PreferenceStore } from "../behavior/preferences/collapse";
import { strings } from "../copy/copy";
import { element } from "../views/dom";
import { createModalGuard, isFocusLost, type ModalGuard } from "../behavior/focus/focus-containment";
import type { ControlsPort } from "@untzel/skin-contract";
import { createLanguageControl, type LanguageControl } from "../behavior/menu/language-control";
import { createLazyMenu, type LazyMenu } from "./lazy-menu";
import { createLazySheet, type LazySheet } from "./lazy-sheet";
import type { LengthTarget, UiState } from "./navigation";
import { createPreviewSoundsSetting, type PreviewSoundsSetting } from "../behavior/preferences/preview-sounds-setting";
import type { MotionChoice } from "@untzel/skin-contract";
import { deletedTexts, offerUndo, removedTexts } from "../behavior/feedback/undo-offer";
import { createAttributionFooter } from "../views/frame/attribution";
import { createCodeSheet, type CodeSheet } from "../views/sheets/code-sheet";
import type { ExportSheet } from "../views/export/export-sheet";
import { createFileOpen } from "../views/idle/file-open";
import { createIdleScreen, type IdleScreen } from "../views/idle/idle-screen";
import { createKeyPicker, type KeyPicker } from "../views/song-settings/key-picker";
import { createLengthPicker, type LengthPicker } from "../views/song-settings/length-picker";
import type { LibrarySheet } from "../views/library/library-sheet";
import { createPartEditor, type PartEditor } from "../views/song/part-editor";
import type { ShareSheet } from "../views/sheets/share-sheet";
import { createSidePanel, type SidePanel } from "../views/frame/side-panel";
import { createSongView, type SongList } from "../views/song/song-view";
import { createTabBar, type TabBar } from "../views/frame/tab-bar";
import { createTempoEditor, type TempoEditor } from "../views/song-settings/tempo-editor";
import { createToast, type Toast } from "../views/frame/toast";
import { createTopBar, type TopBar, type TopBarOptions } from "../views/frame/top-bar";
import { createTrackDetail, type TrackDetail } from "../views/track/track-detail";
import { createTrackEmptyState, type TrackEmptyState } from "../views/track/track-empty-state";
import { createTrackGrid, type TrackGrid } from "../views/track/track-grid";
import { createTrackTable, type TrackTable } from "../views/track/track-table";
import { createTransportBar, type TransportBar } from "../views/transport/transport-bar";
import { createUndoRedoButtons, type UndoRedoButtons } from "../views/frame/undo-redo-buttons";

const EDITING_ID = "ui-editing";
const MENU_ID = "ui-menu";
const VIEWS_NAV_ID = "ui-views-nav";

/** What the shell's options give the views. */
export interface ShellViewsSettings {
  readonly exportLogoUrl: string;
  readonly wordmarkUrl: string;
  readonly translator?: Translator;
  readonly localeStore?: LocaleStore | null;
  readonly motion: MotionChoice;
  readonly version: string;
  readonly initialStep?: number;
}

/** How the views open and close screens: the shell's navigator. */
export interface ShellViewsNavigation {
  readonly navigate: (next: Partial<UiState>) => void;
  readonly dismiss: () => boolean;
  readonly toggleCode: () => void;
  readonly toggleMenu: TopBarOptions["onMenu"];
  readonly openStatement: (overlay: "tempo" | "key", button: HTMLElement) => void;
  readonly openLength: (target: LengthTarget, chip: HTMLElement) => void;
}

/** The shell's parts the views reach; render arrives late-bound. */
export interface ShellViewsWiring {
  readonly port: ControlsPort;
  readonly store: PreferenceStore | null;
  readonly isMac: boolean;
  /** The polite live region, the app's last child. */
  readonly live: HTMLElement;
  /** The Code panel's width divider, on the side panel's edge. */
  readonly divider: HTMLElement;
  readonly announce: (message: string) => void;
  /** Draws the current view. */
  readonly render: () => void;
  readonly openLibrary: () => void;
  readonly toggleControls: () => void;
}

/** The sheets that only the running music opens, by their overlay. */
export interface LazyOverlays {
  readonly library: LazySheet<LibrarySheet>;
  readonly export: LazySheet<ExportSheet>;
  readonly share: LazySheet<ShareSheet>;
}

export interface ShellSheets {
  readonly code: CodeSheet;
  readonly codeHistory: UndoRedoButtons;
  readonly lazy: LazyOverlays;
  readonly tempoEditor: TempoEditor;
  readonly keyPicker: KeyPicker;
  readonly picker: LengthPicker;
  readonly menus: LazyMenu;
}

export interface ShellChrome {
  readonly app: HTMLElement;
  readonly stageHost: HTMLElement;
  readonly main: HTMLElement;
  readonly editing: HTMLElement;
  readonly topBar: TopBar;
  readonly idle: IdleScreen;
  readonly toast: Toast;
  readonly tabBar: TabBar;
  readonly sidePanel: SidePanel;
  readonly guard: ModalGuard;
  readonly language: LanguageControl;
  readonly previewSounds: PreviewSoundsSetting;
}

export interface ShellViews {
  readonly transport: { readonly bar: TransportBar; readonly history: UndoRedoButtons };
  readonly tracks: { readonly grid: TrackGrid; readonly table: TrackTable; readonly empty: TrackEmptyState; readonly detail: TrackDetail };
  readonly song: { readonly list: SongList; readonly partEditor: PartEditor };
  readonly sheets: ShellSheets;
  readonly chrome: ShellChrome;
}

/**
 * Every view of the booth, created in the order the shell always created them (each
 * text binding subscribes to the language as its view is built) and attached in the same order.
 */
// Over 40 lines: creation and attachment order is one ordered list, and the views' callbacks
// close over the views created after them, as the shell's always did.
export function createShellViews(settings: ShellViewsSettings, wiring: ShellViewsWiring, navigation: ShellViewsNavigation): ShellViews {
  const { port, announce, render, openLibrary } = wiring;
  const { navigate, openLength } = navigation;
  const stageHost = element("div", { className: "ui-stage", attributes: { "aria-hidden": "true" } });
  const toast = createToast(() => main.focus({ preventScroll: true }));
  // One session history, two places to reach it by touch.
  const transportHistory = createUndoRedoButtons(port, "ui-undo-redo--transport", (text) => toast.note(text));
  const codeHistory = createUndoRedoButtons(port, "ui-undo-redo--code", (text) => toast.note(text));
  const previewSounds = createPreviewSoundsSetting(wiring.store);
  const topBar = createTopBar({
    wordmarkUrl: settings.wordmarkUrl,
    menuId: MENU_ID,
    onExport: () => navigate({ overlay: "export" }),
    onMenu: (via) => navigation.toggleMenu(via),
    onRename: (title) => port.renameSong(title),
    announce,
  });
  const files = createFileOpen((file) => port.openFile(file));
  // The menu's Language group chooses through this control.
  const language = createLanguageControl({
    ...(settings.translator === undefined ? {} : { translator: settings.translator }),
    ...(settings.localeStore === undefined ? {} : { store: settings.localeStore }),
    onChange: render,
  });
  const idle = createIdleScreen(port, announce);
  const transport = createTransportBar(port, {
    onCode: navigation.toggleCode,
    onToggleControls: wiring.toggleControls,
    onLength: () => openLength("loop", transport.length),
    onTempo: (button) => navigation.openStatement("tempo", button),
    onKey: (button) => navigation.openStatement("key", button),
    history: transportHistory.root,
    controls: [EDITING_ID, VIEWS_NAV_ID],
  });
  const openDetail = (track: string): void => navigate({ panel: "track", selectedTrack: track, overlay: null });
  const openPart = (part: number): void => navigate({ panel: "part", selectedPart: part, overlay: null });
  const renameTrack = (track: string): void => {
    openDetail(track);
    detail.editName();
  };
  const grid = createTrackGrid(port, { onTune: openDetail, onAddTrack: openLibrary });
  const table = createTrackTable(port, { onSelect: openDetail, onAddTrack: openLibrary, onRename: renameTrack });
  const empty = createTrackEmptyState(port, openLibrary, (track) => announce(strings.trackStarted(track)));
  const songList = createSongView(port, {
    onOpenPart: openPart,
    onRenamePart: (part) => {
      openPart(part);
      partEditor.editName();
    },
  });
  // Every close control (sheet ×, panel ×, Esc, backdrop) calls dismiss: one rule, closeTop.
  const close = (): void => void navigation.dismiss();
  const detail = createTrackDetail(port, {
    onClose: close,
    onDuplicated: openDetail,
    onDeleted: (track) => {
      offerUndo(toast, port, deletedTexts(track));
      // The deleted track's opener is gone: the keyboard waits next to Undo.
      // A tap leaves the focus alone, so the toast still goes by itself.
      if (isFocusLost(document, main) && main.matches(":focus-visible")) toast.focusAction();
    },
    onLength: () => openLength("pattern", detail.length),
    onChangeSound: (track) => navigate({ overlay: "library", libraryTrack: track }),
    onRemoved: (what) => offerUndo(toast, port, removedTexts(what)),
    // A refused name leaves the track as it was: the detail stays on it.
    onRenamed: (track) => {
      if (port.view().tracks.some((entry) => entry.name === track)) openDetail(track);
    },
    previewSounds,
    onEditingBar: render,
    announce,
    ...(settings.initialStep === undefined ? {} : { initialStep: settings.initialStep }),
  });
  const partEditor = createPartEditor(port, {
    onClose: close,
    onLength: () => openLength("part", partEditor.length),
    onMoved: (part) => navigate({ selectedPart: part }),
    announce,
  });
  const code = createCodeSheet(close, codeHistory.root);
  // Only the running music opens the library, Export and Share: their sheets load after the
  // first paint (lazy-sheet.ts), and opening one before that waits for it.
  const library = createLazySheet(() => import("../views/library/library-sheet").then(({ createLibrarySheet }) => createLibrarySheet(port, {
    onClose: close,
    onAdded: (track) => {
      announce(strings.trackAdded(track));
      openDetail(track);
    },
    onSoundChanged: (track) => {
      announce(strings.trackNewSound(track));
      navigate({ overlay: null });
      detail.changeSound.focus({ preventScroll: true });
    },
  })), render);
  const tempoEditor = createTempoEditor(port, close);
  const keyPicker = createKeyPicker(port, close);
  const exporter = createLazySheet(() => import("../views/export/export-sheet").then(({ createExportSheet }) => createExportSheet(port, settings.exportLogoUrl, close)), render);
  const sharer = createLazySheet(() => import("../views/sheets/share-sheet").then(({ createShareSheet }) => createShareSheet(port, close)), render);
  // Outside the panel, so on the desktop it is a popover next to the chip that opened it.
  const picker = createLengthPicker(close);
  const tracksView = element("div", { className: "ui-view ui-view--tracks" }, [grid.root, empty.root]);
  const songView = element("div", { className: "ui-view ui-view--song" }, [songList.root]);
  // What the toggle hides: everything under the transport. display: contents, so the
  // views keep their place in the layout; [hidden] removes them all at once.
  const editing = element("div", { className: "ui-editing", attributes: { id: EDITING_ID } }, [songView, tracksView, table.root]);
  const main = element("main", { className: "ui-main", attributes: { tabindex: -1 } }, [
    idle.root,
    element("div", { className: "ui-live" }, [transport.root, editing]),
  ]);
  const menus = createLazyMenu({
    port,
    menuId: MENU_ID,
    version: settings.version,
    isMac: wiring.isMac,
    toast,
    previewSounds,
    motion: settings.motion,
    language,
    anchor: () => topBar.menuButton.root,
    announce,
    navigate: (next) => navigate(next),
    dismiss: () => navigation.dismiss(),
    pickFile: files.pick,
    renameSong: () => topBar.title.edit(),
  }, render);
  const sidePanel = createSidePanel({
    onTab: (panel) => navigate({ panel, isCodeShown: false, overlay: null }),
    onClose: close,
    divider: wiring.divider,
    sheets: [detail.root, partEditor.root, code.root, library.slot, sharer.slot, exporter.slot, menus.panelSlot],
  });
  const backdrop = element("div", { className: "ui-backdrop", attributes: { "aria-hidden": "true" } });
  backdrop.addEventListener("click", close);
  const tabBar = createTabBar(VIEWS_NAV_ID, (tab) => navigate({ tab, panel: null, overlay: null }));
  const guard = createModalGuard({ doc: document, main, nav: tabBar.root });
  const app = element("div", { className: "ui-app" }, [stageHost, topBar.root, main, backdrop, sidePanel.root, picker.root, tempoEditor.root, keyPicker.root, menus.floatingSlot, toast.root, tabBar.root, ...files.nodes, wiring.live]);
  files.attachDrop(app, () => port.view().phase);
  return {
    transport: { bar: transport, history: transportHistory },
    tracks: { grid, table, empty, detail },
    song: { list: songList, partEditor },
    sheets: { code, codeHistory, lazy: { library, export: exporter, share: sharer }, tempoEditor, keyPicker, picker, menus },
    chrome: { app, stageHost, main, editing, topBar, idle, toast, tabBar, sidePanel, guard, language, previewSounds },
  };
}

/** The app and the Attribution footer beside it, outside .ui-app. */
export function createFrame(app: HTMLElement): HTMLElement {
  return element("div", { className: "ui-frame" }, [app, createAttributionFooter()]);
}
