// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SoundIntents } from "@untzel/skin-contract";
import type { SoundEdits } from "@untzel/session";
import type { ControlsFeedback } from "./feedback";

/** The sound picker, the effect list and Change sound of the track detail. */
export class SoundControls implements SoundIntents {
  readonly #edits: SoundEdits;
  readonly #feedback: ControlsFeedback;

  constructor(edits: SoundEdits, feedback: ControlsFeedback) {
    this.#edits = edits;
    this.#feedback = feedback;
  }

  setSound(track: string, sound: string | null): void {
    if (this.#feedback.report(this.#edits.setSound(track, sound))) this.#feedback.noteChange(track, "sound", sound ?? "default");
  }

  addEffect(track: string, effect: string): void {
    if (this.#feedback.report(this.#edits.addEffect(track, effect))) this.#feedback.noteChange(track, effect, "added");
  }

  removeEffect(track: string, effect: string): void {
    if (this.#feedback.report(this.#edits.removeEffect(track, effect))) this.#feedback.noteChange(track, effect, "removed");
  }

  /** Change sound's preview: the track itself plays the new sound in the music; the text stays. */
  previewTrackSound(track: string, instrument: string, sound: string | null): void {
    this.#feedback.report(this.#edits.previewTrackSound(track, instrument, sound));
  }

  /** Change sound: another instrument, the same pattern; one undo step. */
  setTrackSound(track: string, instrument: string, sound: string | null): void {
    if (this.#feedback.report(this.#edits.setTrackSound(track, instrument, sound))) {
      this.#feedback.noteChange(track, "sound", sound === null ? instrument : `${instrument} ${sound}`);
    }
  }
}
