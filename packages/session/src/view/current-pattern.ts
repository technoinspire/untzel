// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Which named pattern of the manifest a track's text plays, in the music's key:
// a query over the session's view, so presentation never reaches the language.
import type { InstrumentManifest } from "@untzel/core";
import { patternInKey } from "@untzel/language";
import type { SessionView, TrackView } from "./view";
function spaced(text: string): string {
  return text.trim().split(/\s+/).join(" ");
}
/** The named pattern the text plays, compared with each pattern moved to the music's key. */
export function currentPatternOf(track: TrackView, manifest: InstrumentManifest, view: SessionView): string | null {
  if (track.pattern === null) return null;
  const written = spaced(view.source.slice(track.pattern.from, track.pattern.to));
  const found = manifest.patterns.find((pattern) => {
    const inKey = patternInKey(pattern.text, manifest.kind, view.key);
    return inKey !== null && spaced(inKey) === written;
  });
  return found?.name ?? null;
}
