// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element } from "../views/dom";

export interface LiveAnnouncer {
  /** The polite live region, the last of the app's children. */
  readonly root: HTMLElement;
  readonly announce: (message: string) => void;
}

/** What screen readers hear: the region empties, then the message arrives 50 ms later. */
export function createLiveAnnouncer(): LiveAnnouncer {
  const root = element("div", { className: "ui-visually-hidden", attributes: { "aria-live": "polite", role: "status" } });
  const announce = (message: string): void => {
    root.textContent = "";
    window.setTimeout(() => (root.textContent = message), 50);
  };
  return { root, announce };
}
