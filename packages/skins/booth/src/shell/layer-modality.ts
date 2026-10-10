// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Which layer is modal: the one rule the shell's modal guard follows. Under
// 1200 px every sheet but Code covers Play, Drop, the tiles and the tab bar, so the top
// one is modal. On the desktop the side panel sits next to a live table and transport (a
// non-modal dialog), and only the tempo, key and length popovers, whose transparent
// backdrop already covers the page for the pointer, are modal. The menu is a menu button:
// Tab closes it, so it never traps the Tab.
import { topLayer, type Overlay, type Panel, type UiState } from "./navigation";

export interface LayerModality {
  /** The layer whose sheet gets aria-modal and makes the page behind it inert; null for none. */
  readonly target: Overlay | Panel | null;
  /** Whether Tab and Shift+Tab cycle inside it. */
  readonly trapsTab: boolean;
}

export interface ModalityContext {
  readonly isDesktop: boolean;
  /** Before the music runs only the menu and the sheets it opens show. */
  readonly isRunning: boolean;
}

const NONE: LayerModality = { target: null, trapsTab: false };
const POPOVERS: ReadonlySet<Overlay> = new Set(["tempo", "key", "length"]);
const ANY_PHASE: ReadonlySet<Overlay> = new Set(["menu", "projects", "shortcuts", "about"]);

export function layerModality(ui: UiState, context: ModalityContext): LayerModality {
  const layer = topLayer(ui);
  if (layer === "overlay" && ui.overlay !== null) return overlayModality(ui.overlay, context);
  if (layer !== "panel" || ui.panel === null || context.isDesktop || !context.isRunning) return NONE;
  return { target: ui.panel, trapsTab: true };
}

function overlayModality(overlay: Overlay, { isDesktop, isRunning }: ModalityContext): LayerModality {
  if (!isRunning && !ANY_PHASE.has(overlay)) return NONE;
  if (isDesktop) return POPOVERS.has(overlay) ? { target: overlay, trapsTab: true } : NONE;
  return { target: overlay, trapsTab: overlay !== "menu" };
}
