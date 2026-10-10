// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song title (`title "…"`). The title arrives from the
// field in the top bar, from a received link and from a file, so it is untrusted text:
// one normalization serves the bar, the tab, the file name and the video.
/** The most a title keeps, counted in code points, never UTF-16 units. */
export const TITLE_MAX_CODE_POINTS = 60;
/** The longest file-name stem `titleSlug` returns. */
export const TITLE_SLUG_MAX_LENGTH = 48;
/**
 * Control characters (Unicode Cc, which includes tab and newline) and the embedding and
 * isolate formatters (U+202A–U+202E, U+2066–U+2069). ZWJ, variation selectors and the
 * plain direction marks U+200E and U+200F stay: they build emoji and leak nothing.
 */
const REMOVED = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu;
/** Cuts at a number of code points; never splits a surrogate pair. */
function firstCodePoints(text: string, count: number): string {
  const points = [...text];
  return points.length <= count ? text : points.slice(0, count).join("");
}
/**
 * In order: drop the removed characters, collapse white space to one space, trim, cut at
 * 60 code points (and trim again, so the cut never ends in a space).
 */
export function normalizeTitle(raw: string): string {
  return firstCodePoints(cleanTitle(raw), TITLE_MAX_CODE_POINTS).trimEnd();
}
/** More than 60 code points once cleaned: normalizeTitle cuts it (TITLE_TOO_LONG). */
export function isTitleTooLong(raw: string): boolean {
  return titleLength(cleanTitle(raw)) > TITLE_MAX_CODE_POINTS;
}
function cleanTitle(raw: string): string {
  return raw.replace(REMOVED, "").replace(/\s+/gu, " ").trim();
}
/** Code points of a title as typed, the unit of the 60 limit. */
export function titleLength(text: string): number {
  return [...text].length;
}
/**
 * A file-name stem: lower case, accents removed (NFD), anything that is not a letter or
 * a digit becomes "-", at most 48 characters. "" when nothing is left.
 */
export function titleSlug(title: string): string {
  const stem = normalizeTitle(title)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return firstCodePoints(stem, TITLE_SLUG_MAX_LENGTH).replace(/-+$/, "");
}
/**
 * `prefix title`, unless the title already starts with one of the known prefixes (in any
 * language, compared without case): "Remix de X" opened in English stays "Remix de X".
 */
export function withPrefix(title: string, prefix: string, knownPrefixes: readonly string[]): string {
  const normalized = normalizeTitle(title);
  const lower = normalized.toLowerCase();
  const isPrefixed = knownPrefixes.some((known) => {
    const candidate = known.toLowerCase();
    return lower === candidate || lower.startsWith(`${candidate} `);
  });
  return isPrefixed ? normalized : normalizeTitle(`${prefix} ${normalized}`);
}
/** `title suffix`, cut at 60 code points: "Midnight Coast (copy)". */
export function withSuffix(title: string, suffix: string): string {
  return normalizeTitle(`${normalizeTitle(title)} ${suffix}`);
}
