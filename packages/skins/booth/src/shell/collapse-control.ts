// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readCollapsed, writeCollapsed, type PreferenceStore } from "../behavior/preferences/collapse";

/** The 200 ms ease-out of the stage and transport, plus margin, before the class goes. */
const COLLAPSE_TRANSITION_MS = 260;

/** What hiding the controls touches, read when the toggle is pressed. */
export interface CollapseSurfaces {
  readonly app: HTMLElement;
  readonly editing: HTMLElement;
  readonly nav: HTMLElement;
  readonly toggle: HTMLElement;
}

export interface CollapseControlOptions {
  readonly store: PreferenceStore | null;
  /** Overrides the stored preference (the preview's ?screen= states). */
  readonly initial: boolean | undefined;
  readonly surfaces: () => CollapseSurfaces;
  readonly render: () => void;
}

export interface CollapseControl {
  readonly isCollapsed: () => boolean;
  readonly set: (isCollapsed: boolean) => void;
  readonly destroy: () => void;
}

/** Hides or shows the editing area. Only layout changes: the music never stops. */
export function createCollapseControl(options: CollapseControlOptions): CollapseControl {
  let collapsed = options.initial ?? readCollapsed(options.store);
  let transitionTimer = 0;
  const set = (next: boolean): void => {
    if (next === collapsed) return;
    const { app, editing, nav, toggle } = options.surfaces();
    const active = document.activeElement;
    collapsed = next;
    writeCollapsed(options.store, collapsed);
    // The stylesheet animates only while this is set, so tab switches stay still.
    app.dataset["transition"] = "collapse";
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => delete app.dataset["transition"], COLLAPSE_TRANSITION_MS);
    options.render();
    // H pressed on a tile that is now hidden: focus goes to the toggle, not to the body.
    const lost = active instanceof HTMLElement && (editing.contains(active) || nav.contains(active));
    if (lost || active === toggle) toggle.focus({ preventScroll: true });
  };
  return { isCollapsed: () => collapsed, set, destroy: () => window.clearTimeout(transitionTimer) };
}
