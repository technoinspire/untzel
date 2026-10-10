// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Normative seeded randomness. Changing any
// formula here changes the sound of every shared link: it is a breaking change.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const RAND_SIGNAL_ELEMENT = 0xffff;
const UINT32_RANGE = 4294967296;

/** Removes comments, normalizes line endings and spacing, drops empty lines. */
/**
 * `title "…"`: the song's name never changes what plays, so renaming keeps every draw.
 * No text written before the title line existed has such a line, so the
 * hash of every older link is unchanged.
 */
const TITLE_LINE = /^title[ \t]*"/;
export function normalizeSource(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const comment = line.indexOf("//");
      const code = comment === -1 ? line : line.slice(0, comment);
      return code.trim().replace(/[ \t]+/g, " ");
    })
    .filter((line) => line.length > 0 && !TITLE_LINE.test(line))
    .join("\n");
}

/** FNV-1a 32-bit over UTF-16 code units, as an unsigned 32-bit integer. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** MurmurHash3 finalizer, unsigned 32-bit. */
export function fmix32(value: number): number {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** fmix32(fmix32(fmix32(a ^ b) ^ c) ^ d). */
export function mix(a: number, b: number, c: number, d: number): number {
  return fmix32(fmix32(fmix32((a ^ b) >>> 0) ^ c) ^ d);
}

/** Reference mulberry32 generator; each call returns the next value in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** fnv1a32(normalizeSource(text)), computed once per Program. */
export function sourceHash(text: string): number {
  return fnv1a32(normalizeSource(text));
}

/** u for the "?" of an element: mulberry32(mix(sourceHash, fnv1a32(track), bar, element)) first value. */
export function probabilityDraw(
  hash: number,
  trackName: string,
  barIndex: number,
  elementIndex: number,
): number {
  return mulberry32(mix(hash, fnv1a32(trackName), barIndex, elementIndex))();
}

/** u for rand(<bars>): mulberry32(mix(sourceHash, fnv1a32(track), period, 0xFFFF)) first value. */
export function randomSignalDraw(hash: number, trackName: string, periodIndex: number): number {
  return mulberry32(mix(hash, fnv1a32(trackName), periodIndex, RAND_SIGNAL_ELEMENT))();
}
