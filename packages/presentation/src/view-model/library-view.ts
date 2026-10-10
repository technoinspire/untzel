// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The instrument library: each instrument with its sounds and patterns, and the audition playing.
import type { InstrumentGroup, InstrumentKind, PitchRange } from "@untzel/core";
import type { SoundView } from "./track-view";

export interface LibraryEntryView {
  readonly instrument: string;
  readonly group: InstrumentGroup;
  /** How many tracks already use it. */
  readonly inSong: number;
  /** One line, English. */
  readonly description: string;
  /** Untzel's model name of the instrument, or null. */
  readonly model: string | null;
  /** Named sounds, the default first. */
  readonly sounds: readonly SoundView[];
  readonly tags: readonly string[];
  readonly kind: InstrumentKind;
  /** Named starting patterns, the first one is what a new track starts with. */
  readonly patterns: readonly string[];
  /** The instrument's parameter names. */
  readonly parameters: readonly string[];
  /** Playable notes; null for drums. */
  readonly range: PitchRange | null;
}

/** The audition playing in the library; null when none. */
export interface AuditionView {
  readonly instrument: string;
  /** The sound playing (the default one when none was chosen). */
  readonly sound: string;
  /** For example "a minor". */
  readonly key: string;
  /** The named pattern playing; null plays the manifest's preview. */
  readonly pattern: string | null;
}
