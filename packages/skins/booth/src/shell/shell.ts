// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { LocaleStore } from "@untzel/i18n/dom";
import type { MountedSkin, SkinOptions } from "@untzel/skin-contract";
import { browserStore, type PreferenceStore } from "../behavior/preferences/collapse";
import type { UiState } from "./navigation";
import { createCodeWidth } from "./code-width";
import { createCollapseControl, type CollapseSurfaces } from "./collapse-control";
import { attachLayoutListeners } from "./layout-listeners";
import { createLiveAnnouncer } from "./live-announcer";
import { attachShellKeyboard, isMacPlatform } from "./shell-keyboard";
import { createShellNavigator } from "./shell-navigator";
import { createShellRender } from "./shell-render";
import { createFrame, createShellViews } from "./shell-views";

export type { LengthTarget, MobileTab, Overlay, Panel, UiState } from "./navigation";

/** What the booth reads beyond what every skin receives: the preview's states and the stores. */
export interface ShellOptions extends SkinOptions {
  readonly initial?: Partial<UiState>;
  /** Step selected when the first track detail opens; defaults to its first filled step. */
  readonly initialStep?: number;
  /** Width from which the side panel replaces bottom sheets. */
  readonly desktopQuery?: string;
  /** Where the hidden-controls preference persists; defaults to localStorage. */
  readonly store?: PreferenceStore | null;
  /** Overrides the stored preference (the preview's ?screen= states). */
  readonly initialCollapsed?: boolean;
  /** Where the language switch saves the choice; defaults to localStorage. */
  readonly localeStore?: LocaleStore | null;
}

export interface Shell extends MountedSkin {
  state(): UiState;
  navigate(next: Partial<UiState>): void;
  isCollapsed(): boolean;
  setCollapsed(isCollapsed: boolean): void;
}

const DEFAULT_DESKTOP_QUERY = "(min-width: 1200px)";
/** Sharing a link: from here on the Share sheet copies the link instead of opening the system sheet. */
const COPY_FIRST_QUERY = "(min-width: 1280px)";
const FIRST_SCREEN: UiState = {
  tab: "tracks",
  panel: null,
  isCodeShown: false,
  overlay: null,
  selectedTrack: null,
  selectedPart: null,
  lengthTarget: "loop",
  libraryTrack: null,
};

/** Lays out every screen and routes gestures to intents. */
// Over 40 lines: the order of wiring (views, listeners, subscriptions, release) is the contract.
export function createShell(options: ShellOptions): Shell {
  const { port } = options;
  const draw = (): void => render(port.view());
  const desktop = window.matchMedia(options.desktopQuery ?? DEFAULT_DESKTOP_QUERY);
  const initial: UiState = { ...FIRST_SCREEN, ...options.initial };
  const shellNavigator = createShellNavigator({ initial, port, views: () => views, render: draw, desktop });
  const { state, navigate, dismiss } = shellNavigator;
  const store = options.store === undefined ? browserStore() : options.store;
  const surfaces = (): CollapseSurfaces => ({ app: views.chrome.app, editing: views.chrome.editing, nav: views.chrome.tabBar.root, toggle: views.transport.bar.toggle });
  const collapse = createCollapseControl({ store, initial: options.initialCollapsed, surfaces, render: draw });
  const copyFirst = window.matchMedia(COPY_FIRST_QUERY);
  const live = createLiveAnnouncer();
  const codeWidth = createCodeWidth(store, () => views.chrome.app);
  const isMac = isMacPlatform(navigator.platform);
  const openLibrary = (): void => navigate({ overlay: "library", libraryTrack: null });
  const toggleControls = (): void => collapse.set(!collapse.isCollapsed());
  const wiring = { port, store, isMac, live: live.root, divider: codeWidth.divider.root, announce: live.announce, render: draw, openLibrary, toggleControls };
  const views = createShellViews(options, wiring, shellNavigator);
  const { layerRoot, closeMenu } = shellNavigator;
  const render = createShellRender({ views, state, port, layerRoot, isCollapsed: collapse.isCollapsed, desktop, copyFirst, close: () => void dismiss(), mountEditor: options.mountEditor });
  // The footer sits outside .ui-app, so no sheet, backdrop or popover inside it can cover
  // the Attribution Phrase.
  options.root.replaceChildren(createFrame(views.chrome.app));
  options.mountStage(views.chrome.stageHost);
  codeWidth.layout();

  const detachKeyboard = attachShellKeyboard(port, { openLibrary, applyNow: () => options.onApplyNow?.(), dismiss, toggleControls, announce: live.announce }, isMac);
  const unsubscribeView = port.subscribe(render);
  const unsubscribeAnnouncements = port.onAnnouncement(live.announce);
  const unsubscribeSettings = [views.chrome.previewSounds.onChange(draw), options.motion.onChange(draw)];
  const { app } = views.chrome;
  const detachLayout = attachLayoutListeners({ desktop, copyFirst, app, transport: views.transport.bar.root, render: draw, closeMenu, layoutCodeWidth: codeWidth.layout });
  render(port.view());

  return {
    state: () => state.ui,
    navigate,
    isCollapsed: collapse.isCollapsed,
    setCollapsed: collapse.set,
    destroy() {
      collapse.destroy();
      detachKeyboard();
      detachLayout();
      views.chrome.guard.destroy();
      unsubscribeView();
      unsubscribeAnnouncements();
      views.chrome.language.destroy();
      for (const unsubscribe of unsubscribeSettings) unsubscribe();
      options.root.replaceChildren();
    },
  };
}
