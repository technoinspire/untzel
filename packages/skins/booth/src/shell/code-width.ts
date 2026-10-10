// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PreferenceStore } from "../behavior/preferences/collapse";
import { setVar } from "../views/dom";
import { panelWidthBounds, panelWidthFor, readPanelWidth, writePanelWidth } from "../behavior/preferences/panel-width";
import { createPanelDivider, type PanelDivider } from "../views/frame/panel-divider";

export interface CodeWidth {
  readonly divider: PanelDivider;
  /** Draws the width for this window: --code-panel-w on the app and the divider's bounds. */
  readonly layout: () => void;
}

/** The Code panel's width on the desktop: wanted, stored, drawn. */
export function createCodeWidth(store: PreferenceStore | null, app: () => HTMLElement): CodeWidth {
  let codeWidth = readPanelWidth(store);
  const layout = (): void => {
    const width = panelWidthFor(codeWidth, window.innerWidth);
    setVar(app(), "--code-panel-w", `${width}px`);
    divider.update({ width, ...panelWidthBounds(window.innerWidth) });
  };
  const setCodeWidth = (wanted: number | null): void => {
    codeWidth = wanted === null ? null : panelWidthFor(wanted, window.innerWidth);
    writePanelWidth(store, codeWidth);
    layout();
  };
  const divider = createPanelDivider({ resize: setCodeWidth, reset: () => setCodeWidth(null) });
  return { divider, layout };
}
