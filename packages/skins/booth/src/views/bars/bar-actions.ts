// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes } from "../dom";
import type { BarIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";
import { canPasteBar, type CopiedBar } from "./bar-thumb-state";

/** Copy bar, Paste here and Clear bar on the bar in edit; Paste waits for a copied bar it can take. */
export function createBarActions(intents: BarIntents, shown: () => TrackView | null, bar: () => number, rerender: () => void): {
  readonly root: HTMLElement;
  render(track: TrackView, editingBar: number): void;
} {
  let copied: CopiedBar | null = null;
  const copy = button("ui-pill ui-pill--raised", strings.copyBar, () => {
    const current = shown();
    if (current !== null && intents.copyBar(current.name, bar())) {
      copied = { track: current.name, bar: bar(), kind: current.kind };
      rerender();
    }
  });
  const paste = button("ui-pill ui-pill--raised", strings.pasteHere, () => {
    const current = shown();
    if (current !== null && paste.getAttribute("aria-disabled") !== "true") intents.pasteBar(current.name, bar());
  });
  const clear = button("ui-pill ui-pill--raised", strings.clearBar, () => {
    const current = shown();
    if (current !== null) intents.clearBar(current.name, bar());
  });
  const root = element("div", { className: "ui-detail__bar-actions", attributes: { role: "group" } }, [copy, paste, clear]);
  return {
    root,
    render(track, editingBar) {
      setAttributes(paste, { "aria-disabled": canPasteBar(copied, track, editingBar) ? null : "true" });
      root.setAttribute("aria-label", phrases.barName(editingBar + 1));
    },
  };
}
