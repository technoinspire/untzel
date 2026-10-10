// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A sheet that only the running music opens, loaded after the first paint (the budget of
// the initial JS up to the waiting stage): a `display: contents` slot holds its place in the
// shell from the start, the page fetches it right after the waiting stage paints, and opening it
// before that waits for it.
import { element } from "../views/dom";

export interface LazySheet<S> {
  /** The sheet's place in the shell; the sheet's root goes inside it once loaded. */
  readonly slot: HTMLElement;
  /** The sheet once loaded; null before. */
  current(): S | null;
  /** Loads once; every later call gets the same sheet. */
  load(): Promise<S>;
  /** Once loaded, updates the sheet, then shows or hides it; nothing before. */
  render(isShown: boolean, update: (sheet: S) => void): void;
}

export function createLazySheet<S extends { readonly root: HTMLElement }>(create: () => Promise<S>, onLoaded: () => void): LazySheet<S> {
  const slot = element("div", { className: "ui-slot" });
  let sheet: S | null = null;
  let loading: Promise<S> | null = null;
  return {
    slot,
    current: () => sheet,
    load() {
      loading ??= create().then((created) => {
        slot.append(created.root);
        sheet = created;
        onLoaded();
        return created;
      });
      return loading;
    },
    render(isShown, update) {
      if (sheet === null) return;
      update(sheet);
      sheet.root.hidden = !isShown;
    },
  };
}
