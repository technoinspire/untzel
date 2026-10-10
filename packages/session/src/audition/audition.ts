// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { stepPitchMidis, type InstrumentKind, type StepPitch } from "@untzel/core";

// Every note the person touches sounds: a step, a key of
// the note picker, a chord, an octave switch. The sound is transient, never written to
// the text; these rules decide how long it lasts and keep one voice per track,
// so dragging across keys plays each new note once. Pure: the caller passes the time.

/** What a touch auditions: a note, a chord, or a drum's hit. */
export type AuditionSound = Extract<StepPitch, { readonly kind: "note" | "chord" }> | { readonly kind: "hit" };

/** Sustained instruments sound this long, then release. */
export const SUSTAINED_AUDITION_MS = 400;
/** The same sound on the same track again within this time is the same touch. */
export const RETRIGGER_MS = 250;
const STEPS_PER_BEAT = 4;

/** About one step for drums (a 16th at the tempo), about 400 ms for the others. */
export function auditionDurationMs(kind: InstrumentKind, bpm: number): number {
  if (kind !== "drum") return SUSTAINED_AUDITION_MS;
  return Math.round(60_000 / Math.max(1, bpm) / STEPS_PER_BEAT);
}

/**
 * The key a drum's hit is sent as: the DSP plays every hit at this note (HIT_NOTE in
 * packages/dsp/src/engines/mod.rs), and drum voices ignore the pitch.
 */
export const HIT_AUDITION_MIDI = 48;

/** The keys a touch plays on the preview slot: the note, the chord's voicing, or the hit. */
export function auditionMidis(sound: AuditionSound): readonly number[] {
  return sound.kind === "hit" ? [HIT_AUDITION_MIDI] : stepPitchMidis(sound);
}

export function auditionKey(sound: AuditionSound): string {
  switch (sound.kind) {
    case "note":
      return sound.note;
    case "chord":
      return `${sound.root}${sound.quality}`;
    case "hit":
      return "hit";
  }
}

/**
 * One audition voice per track. A new sound on a track replaces the one before (the
 * engine cuts it with a short release); the same sound again within RETRIGGER_MS is not
 * played twice, so a drag or a double event never piles voices up.
 */
export class AuditionVoices {
  readonly #last = new Map<string, { readonly key: string; readonly at: number }>();

  /** True when this touch should sound now. */
  admit(track: string, sound: AuditionSound, nowMs: number): boolean {
    const key = auditionKey(sound);
    const last = this.#last.get(track);
    if (last !== undefined && last.key === key && nowMs - last.at < RETRIGGER_MS) return false;
    this.#last.set(track, { key, at: nowMs });
    return true;
  }
}
