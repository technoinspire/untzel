// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The instruments' and sounds' descriptions come from their manifests, in English. The
// composition root translates them with the page's catalog (the same one the library and
// the sound picker use), so the hover help speaks the page's language too.

export interface Describer {
  /** The instrument's description in the page's language; `english` is the manifest's. */
  instrument(instrument: string, english: string): string;
  /** A named sound's description in the page's language; `english` is the manifest's. */
  sound(instrument: string, sound: string, english: string): string;
}

/** The manifests' own text, for callers without a catalog (tests, the offline tools). */
export const MANIFEST_DESCRIBER: Describer = {
  instrument: (_instrument, english) => english,
  sound: (_instrument, _sound, english) => english,
};
