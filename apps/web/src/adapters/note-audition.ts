// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { auditionMidis, type AuditionSound, type NoteAudition } from "@untzel/session";

export interface AuditionEvent {
  readonly track: string;
  readonly sound: AuditionSound;
  readonly durationMs: number;
}

/** The part of the library's Audition this adapter needs: one note now, on a track's sound. */
export interface NotePlayer {
  playNote(track: string, midis: readonly number[], seconds: number): boolean;
}

/** The last events kept, for the browser tests' hook; enough for a whole gesture. */
const KEPT_EVENTS = 32;

/**
 * The NoteAudition port over the preview path: every
 * touched note goes to the Audition's playNote, which sends it to the preview slot of
 * the DspHost on the track's own instrument, sound, effects and gain. The keys come from
 * the session's auditionMidis; this adapter only translates milliseconds to seconds and
 * keeps the latest events for the test hook.
 */
export class PreviewNoteAudition implements NoteAudition {
  readonly #player: NotePlayer;
  readonly #events: AuditionEvent[] = [];

  constructor(player: NotePlayer) {
    this.#player = player;
  }

  audition(track: string, sound: AuditionSound, durationMs: number): void {
    this.#events.push({ track, sound, durationMs });
    if (this.#events.length > KEPT_EVENTS) this.#events.shift();
    this.#player.playNote(track, auditionMidis(sound), durationMs / 1_000);
  }

  events(): readonly AuditionEvent[] {
    return [...this.#events];
  }
}
