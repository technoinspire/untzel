// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// What the track controls front shows of one track: who
// overrides Tone, which named pattern the text plays in the music's key, what previews,
// and what the pattern plays for Change sound. Pure, tested in Node.

import type { InstrumentRegistry, PitchRange } from "@untzel/core";
import { currentPatternOf, toneOverridesOf, type SessionView, type TrackView } from "@untzel/session";
import type { TrackView as ControlTrackView } from "./view-model";

type ControlsFields = Pick<
  ControlTrackView,
  "hasTone" | "toneSetBy" | "patterns" | "currentPattern" | "previewing" | "previewingSound" | "content" | "noteSpan" | "writtenParameters"
>;

/** Lowest and highest note the pattern writes (chords count their notes). */
export function noteSpanOf(track: TrackView): PitchRange | null {
  const midis = track.bars.flatMap((bar) => bar.flatMap((step) => (step.kind === "note" ? [step.midi] : step.kind === "chord" ? step.midis : [])));
  return midis.length === 0 ? null : { lowest: Math.min(...midis), highest: Math.max(...midis) };
}

export function trackControlsFields(track: TrackView, registry: InstrumentRegistry, view: SessionView): ControlsFields {
  const manifest = registry.get(track.instrument);
  const preview = view.trackPreview?.track === track.name ? view.trackPreview : null;
  // Change sound previews another instrument or sound; a pattern chip keeps both.
  const sound = preview !== null && (preview.instrument !== track.instrument || preview.preset !== track.preset)
    ? { instrument: preview.instrument, sound: preview.preset ?? registry.get(preview.instrument)?.defaultPreset ?? "" }
    : null;
  return {
    hasTone: (manifest?.tone.length ?? 0) > 0,
    toneSetBy: manifest === undefined ? [] : toneOverridesOf(track, manifest).map((entry) => ({ parameter: entry.parameter, isSignal: entry.isSignal })),
    patterns: manifest?.patterns.map((pattern) => pattern.name) ?? [],
    currentPattern: manifest === undefined ? null : currentPatternOf(track, manifest, view),
    previewing: preview?.label ?? null,
    previewingSound: sound,
    content: track.content,
    noteSpan: noteSpanOf(track),
    writtenParameters: manifest === undefined ? [] : manifest.parameters.filter((definition) => track.parameters.some((entry) => entry.name === definition.name && entry.explicit)).map((definition) => definition.name),
  };
}
