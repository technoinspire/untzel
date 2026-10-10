// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { setVar } from "../views/dom";

export interface LayoutListenersOptions {
  /** Width from which the side panel replaces bottom sheets. */
  readonly desktop: MediaQueryList;
  /** Sharing a link: from here on the Share sheet copies the link. */
  readonly copyFirst: MediaQueryList;
  readonly app: HTMLElement;
  readonly transport: HTMLElement;
  /** Draws the current view. */
  readonly render: () => void;
  readonly closeMenu: () => void;
  readonly layoutCodeWidth: () => void;
}

/** What the window's size changes in the layout; returns one detach, in the same order. */
export function attachLayoutListeners(options: LayoutListenersOptions): () => void {
  const { desktop, copyFirst, render, layoutCodeWidth } = options;
  // Crossing 1200 px changes the whole layout: an open menu closes, focus to its button.
  // Crossing 1280 only reorders the Share sheet, so the menu stays where it is.
  const onDesktopChange = (): void => {
    options.closeMenu();
    render();
  };
  desktop.addEventListener("change", onDesktopChange);
  copyFirst.addEventListener("change", render);
  window.addEventListener("resize", layoutCodeWidth);
  // With the controls hidden the stage ends where the transport starts: one row, or two
  // when a wide Code panel narrows the stage and the transport wraps.
  const transportSize = new ResizeObserver(() => setVar(options.app, "--transport-block", `${options.transport.offsetHeight}px`));
  transportSize.observe(options.transport);
  return () => {
    desktop.removeEventListener("change", onDesktopChange);
    copyFirst.removeEventListener("change", render);
    window.removeEventListener("resize", layoutCodeWidth);
    transportSize.disconnect();
  };
}
