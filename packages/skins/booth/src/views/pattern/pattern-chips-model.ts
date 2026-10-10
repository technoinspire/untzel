// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TrackView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

// The pattern chips of the track detail: which chip is the text, which
// one plays as a preview, and the words of the preview box. The adapter already compared
// the text with each pattern in the music's key (currentPattern); nothing is moved here.


export interface PatternChip {
  readonly name: string;
  /** The text plays it: flare outline and ✓, aria-pressed. */
  readonly isCurrent: boolean;
  /** It plays as a preview: dashed outline and a speaker. */
  readonly isPreviewing: boolean;
}

export interface PatternPreviewBox {
  readonly title: string;
  readonly note: string;
  readonly useLabel: string;
  /** Title and note as one sentence, for the polite status region. */
  readonly announcement: string;
}

export interface PatternChipsModel {
  readonly label: string;
  readonly chips: readonly PatternChip[];
  /** "Your own pattern" when the text is none of them. */
  readonly caption: string | null;
  readonly preview: PatternPreviewBox | null;
}

function previewBox(pattern: string): PatternPreviewBox {
  const title = strings.previewingPattern(pattern);
  const note = strings.trackPreviewNote;
  return { title, note, useLabel: strings.useChoice(pattern), announcement: `${title}. ${note}` };
}

export function patternChipsModel(track: TrackView): PatternChipsModel {
  const previewing = track.patterns.includes(track.previewing ?? "") ? track.previewing : null;
  return {
    label: strings.patternsFor(track.name),
    chips: track.patterns.map((name) => ({ name, isCurrent: name === track.currentPattern, isPreviewing: name === previewing })),
    caption: track.currentPattern === null && previewing === null ? strings.ownPattern : null,
    preview: previewing === null ? null : previewBox(previewing),
  };
}

/** A tap on a chip: preview it; on the chip already previewing, write it (the second tap confirms). */
export function chipAction(model: PatternChipsModel, chip: string): "preview" | "use" | "none" {
  const found = model.chips.find((entry) => entry.name === chip);
  if (found === undefined || (found.isCurrent && !found.isPreviewing)) return "none";
  return found.isPreviewing ? "use" : "preview";
}
