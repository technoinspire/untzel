// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { toneOverriddenBy, type InstrumentManifest, type ToneOverride } from "@untzel/core";
import type { TrackView } from "./view";

// Who overrides Tone on a track of the view: the one place that reads
// a TrackView's parameters as core's WrittenParameter. Use Tone removes exactly these;
// the track detail shows exactly these.

export function toneOverridesOf(track: TrackView, manifest: InstrumentManifest): readonly ToneOverride[] {
  const written = track.parameters.map((parameter) => ({ name: parameter.name, explicit: parameter.explicit, isSignal: parameter.signal !== null }));
  return toneOverriddenBy(manifest, written);
}
