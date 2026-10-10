// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { RangeIntents } from "@untzel/skin-contract";
import type { PlayRangeView } from "@untzel/presentation/view-model";
import type { EditingBarView } from "./range-ruler-model";
import type { RangeStrip } from "./range-strip";

export interface LazyRange {
  update(view: PlayRangeView, editing: EditingBarView | null): void;
  cancelPending(): void;
}

/**
 * The range strip, imported on the first update; the latest view waits for it. A chunk
 * that fails to load is logged and tried again on the next update, never left pending.
 */
export function lazyRangeStrip(intents: RangeIntents, slot: HTMLElement, onReady: (strip: RangeStrip) => void, onPending: (isPending: boolean) => void): LazyRange {
  let strip: RangeStrip | null = null;
  let latest: { readonly view: PlayRangeView; readonly editing: EditingBarView | null } | null = null;
  let isLoading = false;
  const load = (): void => {
    isLoading = true;
    import("./range-strip")
      .then(({ createRangeStrip }) => {
        strip = createRangeStrip(intents, onPending);
        strip.root.classList.add("ui-transport__range");
        slot.replaceWith(strip.root);
        onReady(strip);
        if (latest !== null) strip.update(latest.view, latest.editing);
      })
      .catch((error: unknown) => {
        isLoading = false;
        console.warn("controls: the play range did not load; trying again on the next update", error);
      });
  };
  return {
    update(view, editing) {
      latest = { view, editing };
      if (strip !== null) strip.update(view, editing);
      else if (!isLoading) load();
    },
    cancelPending: () => strip?.cancelPending(),
  };
}
