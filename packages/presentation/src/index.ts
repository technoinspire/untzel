// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The presenters: the session's view in, the screens' view model out. The view
// model's types are @untzel/presentation/view-model; the waiting stage's view is
// @untzel/presentation/waiting, the two light entries of the initial JS.
export { presentView, type PresentContext } from "./present-view";
export { keyLabel, midiName } from "./music-names";
export { DEFAULT_BPM, barPosition } from "./playback-now";
export { captionSection, hintedTrack, isTrackMuted, trackPlayState } from "./loop-section-view";
export { effectViews, gainSlider, mixParameters, presetViews, soundParameters } from "./parameter-view";
export { trackControlsFields } from "./track-controls-view";
export type { InstrumentDescriptions, ParameterLabels } from "./presentation-copy";
