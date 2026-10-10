// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { RangeGesture } from "@untzel/skin-contract";
import { sameEdges, type Edges, type Handle, type RulerScale, type RulerView } from "./ruler-geometry";

export interface RangeRulerEvents {
  /** "drag" while a handle moves, "release" when it is let go, "key" for a key on it. */
  readonly onEdges: (edges: Edges, gesture: RangeGesture) => void;
  /** A bar tapped, 1-based. */
  readonly onTap: (bar: number) => void;
}

/** Each handle is a slider for the keyboard: its keys move that edge by the ruler's scale. */
export function bindRulerKeys(handles: Readonly<Record<Handle, HTMLElement>>, events: RangeRulerEvents, shown: () => RulerView | null, scaleOf: () => RulerScale | null): void {
  for (const handle of ["start", "end"] as const) {
    handles[handle].addEventListener("keydown", (event) => {
      const view = shown();
      const scale = scaleOf();
      if (view === null || scale === null || view.isInert) return;
      const next = scale.key(handle, event.key, event.shiftKey);
      if (next === null) return;
      event.preventDefault();
      if (!sameEdges(next, view.edges)) events.onEdges(next, "key");
    });
  }

}
