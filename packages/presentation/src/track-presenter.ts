// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One track of the view model: its tile state, steps, sliders, sounds and effects, and
// what the track controls front shows of it. Pure.
import type { InstrumentRegistry, PitchRange } from "@untzel/core";
import type { SessionView, StepView, TrackView } from "@untzel/session";
import { isTrackMuted, trackPlayState } from "./loop-section-view";
import { midiName } from "./music-names";
import { effectViews, mixParameters, presetViews, soundParameters, toneOf } from "./parameter-view";
import { wrap, type Now } from "./playback-now";
import type { InstrumentDescriptions, ParameterLabels } from "./presentation-copy";
import { trackControlsFields } from "./track-controls-view";
import type { StepView as ControlStepView, TrackView as ControlTrackView } from "./view-model";
/**
 * c0 to c7, only for a track whose manifest has no `range` (drums, which never open the
 * note picker, or an unknown instrument). Pitched and chord instruments use their own
 * range.
 */
export const UNRANGED_PITCH_RANGE: PitchRange = { lowest: 12, highest: 96 };
/** The words a track's sliders and sounds are written with. */
export interface TrackWords {
  readonly labels: ParameterLabels;
  readonly descriptions: InstrumentDescriptions;
}
/** `text` is the session source: a chord shows as written ("Cm7"), not as its lowest note. */
export function stepView(step: StepView, text: string): ControlStepView {
  switch (step.kind) {
    case "rest":
    case "hit":
    case "accent":
      return { kind: step.kind, label: null };
    case "sustain":
      return { kind: "hold", label: null };
    case "note":
      return { kind: "note", label: midiName(step.midi) };
    case "chord":
      return { kind: "chord", label: text.slice(step.source.from, step.source.to) || null };
    case "group":
      return { kind: "hit", label: null };
  }
}
export function trackView(track: TrackView, registry: InstrumentRegistry, now: Now | null, view: SessionView, hinted: string | null, words: TrackWords): ControlTrackView {
  const text = view.source;
  const manifest = registry.get(track.instrument);
  const bars = Math.max(1, track.bars.length);
  return {
    name: track.name,
    instrument: track.instrument,
    group: manifest?.group ?? "drums",
    kind: manifest?.kind ?? "drum",
    line: track.line,
    playState: trackPlayState(track, view.mode ?? "loop"),
    isHinted: track.name === hinted,
    isMuted: isTrackMuted(track, view.mode ?? "loop"),
    isSoloed: track.soloed,
    steps: (track.bars[0] ?? []).map((step) => stepView(step, text)),
    bars,
    patternBars: track.bars.map((cells) => cells.map((step) => stepView(step, text))),
    playingBar: now === null ? null : wrap(now.patternBar, bars),
    isScaleLocked: !track.free,
    pitchRange: manifest?.range ?? UNRANGED_PITCH_RANGE,
    tone: toneOf(track, manifest),
    sound: soundParameters(track, manifest, words.labels),
    mix: mixParameters(track, words.labels),
    preset: track.preset ?? manifest?.defaultPreset ?? "",
    presets: presetViews(manifest, words.descriptions),
    effects: effectViews(track, words.labels),
    ...trackControlsFields(track, registry, view),
  };
}
