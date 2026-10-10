// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The timbre gate's thresholds as data, with the b.1 targets. A subject id is
// "<instrument> <preset>"; every id here must exist in the
// registry, or the gate fails (a renamed preset cannot silently drop its rule).

/** Two presets of the same instrument: MFCC40 at least this far apart... */
export const PRESET_MIN = 10;
/** ...unless attack or decay differ by this ratio (at most one such pair per instrument). */
export const ENVELOPE_VARIANT_RATIO = 2;
/** Two instruments of the same group, default presets. */
export const SAME_GROUP_MIN = 15;
/**
 * The kick rule. A club kick has a
 * 20-30 ms sweep, a 42-60 Hz body and little overtone, so two club kicks share most of
 * their MFCC: variety comes from drive, decay and click instead. Two kicks (two presets,
 * or the kicks of two templates as their lines play them) differ when their MFCC40 is at
 * least KICK_MFCC_MIN apart (60% of the whole-tone ruler, 6.76) or their decay differs by
 * KICK_DECAY_RATIO. No envelope-only allowance per instrument: every pair must differ.
 */
export const KICK_INSTRUMENT = "kick";
export const KICK_MFCC_MIN = 4;
export const KICK_DECAY_RATIO = 1.5;
/** Report (e), kit without repetition section: drum sounds two templates may share. */
export const TEMPLATE_SHARED_DRUMS_MAX = 2;
/**
 * The club range of every template mix (it replaces the rule that kept
 * template spectra ≥ 6 dB apart, which rewarded unbalanced mixes). Measured on the main
 * section, 16 bars: the per-Hz tilt over 125 Hz to 8 kHz, each octave from 63 Hz to 8 kHz
 * against a −4.5 dB/octave line (the analyser slope of a club master), and the K-weighted
 * share of the cymbals in the sum of the stems.
 */
export const CLUB_TARGET_PSD_SLOPE = -4.5;
export const CLUB_TILT_RANGE: readonly [number, number] = [-6, -3.5];
export const CLUB_OCTAVE_DELTA_MAX_DB = 5;
export const CLUB_TOP_SHARE_RANGE: readonly [number, number] = [-16, -10];
/**
 * The sounds that sign the six studied templates, as "<instrument> <preset>" or a bare
 * instrument (any preset). The gate fails when a template stops playing one. One
 * departure: Night Garden plays the organ, without the epiano.
 */
export const TEMPLATE_SIGNATURES: Readonly<Record<string, readonly string[]>> = {
  "melodic-techno/midnight-bloom": ["pluck", "lead", "pad"],
  "afro-house/red-earth": ["cowbell", "kalimba", "mallet marimba", "choir chant"],
  "indie-dance/coastline": ["piano felt", "supersaw", "vox"],
  "deep-house/night-garden": ["organ"],
  "downtempo/blue-lounge": ["epiano bark", "harp", "bell", "reese dark"],
  "acid-techno/warehouse": ["acid squelch", "square chip"],
};

/** How a subject is played for a pair target: a held c3, or the chord c3+eb3+g3. */
export type TargetRender = "note" | "chord";

export interface PairTarget {
  readonly a: string;
  readonly b: string;
  readonly min: number;
  readonly render: TargetRender;
  /** Where the number comes from. */
  readonly source: string;
}

const pair = (a: string, b: string, min: number, source: string, render: TargetRender = "note"): PairTarget => ({ a, b, min, render, source });

export const PAIR_TARGETS: readonly PairTarget[] = [
  pair("mallet marimba", "mallet vibes", 15, "b.1-2"),
  pair("lead classic", "pad warm", 15, "b.1-3"),
  pair("brass section", "strings ensemble", 15, "b.1-3"),
  pair("pad warm", "strings ensemble", 15, "b.1-3"),
  pair("pad warm", "strings ensemble", 15, "b.1-5", "chord"),
  pair("brass section", "pad warm", 15, "b.1-4", "chord"),
  pair("supersaw anthem", "supersaw wide", 10, "b.1-6"),
  pair("supersaw anthem", "stab classic", 15, "b.1-6"),
  pair("kick punch", "impact hit", 15, "b.1-8"),
  pair("epiano tine", "fm-bass pluck", 15, "b.1-9"),
  pair("epiano tine", "piano grand", 15, "b.1-9"),
  pair("epiano tine", "piano grand", 15, "b.1-9", "chord"),
  // b.1-10 (choir ~ vox ≥ 25) is out of this branch: choir and vox play sampled singers;
  // the formant engine stays as it is.
  pair("acid classic", "reese wide", 15, "b.1-11"),
  // Report (d) rule 3: confusable pairs across groups, and the presets of 1.2.
  pair("mallet marimba", "sub pure", 12, "report 1.2"),
  pair("piano grand", "kalimba tine", 12, "report 1.2"),
  pair("piano grand", "kalimba tine", 12, "report 1.2", "chord"),
  pair("stab rave", "supersaw thin", 12, "report 1.2"),
  pair("epiano soft", "piano bright", 12, "report 1.2"),
  pair("bass round", "acid soft", 12, "report 1.2"),
];

/** A measured property of one sound (b.1), on its held c3 unless it is a drum hit. */
export type SpectralTarget =
  | {
      readonly kind: "partials";
      readonly subject: string;
      /** Frequency ratios to the fundamental whose level is checked. */
      readonly ratios: readonly number[];
      /** Allowed level relative to the fundamental, dB. */
      readonly minDb: number;
      readonly maxDb: number;
      readonly source: string;
    }
  | { readonly kind: "centroid"; readonly subject: string; readonly minHz: number; readonly source: string }
  | { readonly kind: "swing"; readonly subject: string; readonly maxDb: number; readonly source: string }
  | { readonly kind: "decay"; readonly subject: string; readonly minSeconds: number; readonly source: string }
  | { readonly kind: "tone"; readonly subject: string; readonly min: number; readonly source: string };

export const SPECTRAL_TARGETS: readonly SpectralTarget[] = [
  { kind: "partials", subject: "piano grand", ratios: [2, 3, 4, 5, 6], minDb: -20, maxDb: -3, source: "b.1-1" },
  { kind: "centroid", subject: "piano grand", minHz: 450, source: "b.1-1" },
  { kind: "partials", subject: "kalimba tine", ratios: [5.93], minDb: -18, maxDb: -10, source: "b.1-1" },
  { kind: "partials", subject: "mallet marimba", ratios: [3.93], minDb: -20, maxDb: -12, source: "b.1-1" },
  { kind: "tone", subject: "kalimba tine", min: 10, source: "b.1-1" },
  { kind: "decay", subject: "mallet vibes", minSeconds: 2, source: "b.1-2" },
  { kind: "swing", subject: "supersaw anthem", maxDb: 4, source: "b.1-3" },
  { kind: "decay", subject: "impact hit", minSeconds: 1.5, source: "b.1-8" },
];

/**
 * A b.1 measurement that is explained instead of met (report (d), explicit exceptions section).
 * It must carry its reason; once the target passes, the exception itself fails, so the
 * list can only shrink.
 */
export interface TargetException {
  readonly kind: SpectralTarget["kind"];
  readonly subject: string;
  /** What it measured when the exception was written. */
  readonly measured: number;
  readonly reason: string;
}

export const TARGET_EXCEPTIONS: readonly TargetException[] = [
  {
    kind: "swing",
    subject: "supersaw anthem",
    measured: 7.9,
    reason:
      "Seven detuned saws summed to mono beat at a few hertz at c3; that beating is the unison itself. The stereo fan (spread, random start phases, irregular detune) took the mono swing from 16.9 to about 8 dB and the stereo power swing to about 4.5 dB; ≤ 4 dB on the mono sum would need a centre-only sound.",
  },
];

