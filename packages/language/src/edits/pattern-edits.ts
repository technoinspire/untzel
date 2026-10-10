// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest, Key, ManifestPattern } from "@untzel/core";
import { EditableSource } from "./document";
import { patternInKey } from "./pattern-key";
import { applyChanges, failure, type EditResult } from "./text-changes";

// A named pattern of the manifest on a track that already exists (the
// pattern chips of the track detail): one edit that replaces only the pattern.

/**
 * Writes `pattern`, moved to `key`, as the track's pattern; the instrument, the sound and
 * every modifier stay. A track without a pattern gets one after its sound.
 */
export function setTrackPattern(
  source: string,
  track: string,
  manifest: InstrumentManifest,
  pattern: ManifestPattern,
  key: Key | null,
): EditResult {
  const text = patternInKey(pattern.text, manifest.kind, key);
  if (text === null) return failure("INVALID_VALUE");
  const found = new EditableSource(source).track(track);
  if (found === null) return failure("UNKNOWN_TRACK");
  const { syntax } = found;
  if (syntax.pattern !== null) return applyChanges(source, [{ from: syntax.pattern.from, to: syntax.pattern.to, insert: text }]);
  const at = (syntax.preset ?? syntax.instrument).to;
  return applyChanges(source, [{ from: at, to: at, insert: ` ${text}` }]);
}
