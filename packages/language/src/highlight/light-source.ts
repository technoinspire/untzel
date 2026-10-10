// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fnv1a32, normalizeSource } from "@untzel/core";
// The two hashes the light is seeded from.
// `| mute` is an edit of the text but never a change of look: it is removed
// before hashing, so muting a track, or the loop mode's Drop that unmutes every track,
// keeps every scene and the whole stage where they are.
//   lightSourceHash = fnv1a32(normalizeSource(stripMuteModifiers(text)))
//   stagePlanHash   = fnv1a32(productionHeader(normalizeSource(stripMuteModifiers(text))))

/** `name: instrument …`: the lines that declare a track. */
const TRACK_LINE = /^\s*[a-z][a-z0-9_-]*\s*:/;
/** One `| mute` modifier, up to the next `|` or the end of the code. */
const MUTE_MODIFIER = /\s*\|\s*mute(?=\s*(?:\||$))/g;

/** Every `| mute` modifier of a track line removed; comments and other lines untouched. */
export function stripMuteModifiers(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const comment = line.indexOf("//");
      const code = comment === -1 ? line : line.slice(0, comment);
      if (!TRACK_LINE.test(code)) return line;
      const kept = code.replace(MUTE_MODIFIER, "").replace(/\s+$/, "");
      return comment === -1 ? kept : `${kept} ${line.slice(comment)}`;
    })
    .join("\n");
}

/** The production's frame: every normalized line that is neither a track nor a section. */
export function productionHeader(normalized: string): string {
  return normalized
    .split("\n")
    .filter((line) => !TRACK_LINE.test(line) && !line.startsWith("section "))
    .join("\n");
}

/** Seeds every per-event draw of the light: changes with any edit but `| mute`. */
export function lightSourceHash(text: string): number {
  return fnv1a32(normalizeSource(stripMuteModifiers(text)));
}

/** Seeds the stage's arrangement: tempo, key, swing, loop and song only. */
export function stagePlanHash(text: string): number {
  return fnv1a32(productionHeader(normalizeSource(stripMuteModifiers(text))));
}
