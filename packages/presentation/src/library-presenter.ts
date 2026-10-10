// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The library of the view model: every instrument with its sounds, patterns and how many
// tracks use it, and the audition playing. Pure.
import type { InstrumentRegistry } from "@untzel/core";
import type { Auditioning, SessionView } from "@untzel/session";
import { keyLabel } from "./music-names";
import { presetViews } from "./parameter-view";
import type { InstrumentDescriptions } from "./presentation-copy";
import type { AuditionView, LibraryEntryView } from "./view-model";
export function libraryView(view: SessionView, registry: InstrumentRegistry, descriptions: InstrumentDescriptions): LibraryEntryView[] {
  return [...registry.values()].map((manifest) => ({
    instrument: manifest.name,
    group: manifest.group,
    kind: manifest.kind,
    patterns: manifest.patterns.map((pattern) => pattern.name),
    parameters: manifest.parameters.map((parameter) => parameter.name),
    range: manifest.range,
    inSong: view.tracks.filter((track) => track.instrument === manifest.name).length,
    description: descriptions.instrumentDescription(manifest.name, manifest.description),
    model: manifest.model,
    sounds: presetViews(manifest, descriptions),
    tags: manifest.tags,
  }));
}
/** The audition playing, with its sound spelled out and the key it plays in. */
export function auditionView(audition: Auditioning | null, view: SessionView, registry: InstrumentRegistry): AuditionView | null {
  if (audition === null) return null;
  const sound = audition.preset ?? registry.get(audition.instrument)?.defaultPreset ?? "";
  return { instrument: audition.instrument, sound, key: keyLabel(view.key), pattern: audition.pattern };
}
