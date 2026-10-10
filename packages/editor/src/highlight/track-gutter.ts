// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Extension } from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";
import { TRACK_COLOR_COUNT } from "@untzel/core";
import { outlineField } from "../assist/outline-field";

// The track bar: 3 px in the track's color along
// every line of the track, its continuation lines included (one gutter element spans
// the whole wrapped line). Classes only; the colors are in styles/language.css.

class TrackBar extends GutterMarker {
  readonly color: number;
  override readonly elementClass: string;

  constructor(color: number) {
    super();
    this.color = color;
    this.elementClass = `u-trackbar u-track-${color}`;
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof TrackBar && other.color === this.color;
  }
}

const BARS = Array.from({ length: TRACK_COLOR_COUNT }, (_, color) => new TrackBar(color));

export function trackGutter(): Extension {
  return [
    outlineField,
    gutter({
      class: "u-track-gutter",
      lineMarker(view, block) {
        const number = view.state.doc.lineAt(block.from).number;
        const track = view.state.field(outlineField).tracks.find((entry) => entry.line === number);
        return track === undefined ? null : (BARS[track.color] ?? null);
      },
      lineMarkerChange: (update) => update.startState.field(outlineField) !== update.state.field(outlineField),
    }),
  ];
}
