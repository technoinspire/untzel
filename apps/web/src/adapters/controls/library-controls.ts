// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { LibraryIntents } from "@untzel/skin-contract";
import { startWithSound, type Audition, type Session, type TrackEdits } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";

/** The Add track library: auditions never touch the text; adding is one edit. */
export class LibraryControls implements LibraryIntents {
  readonly #session: Session;
  readonly #edits: TrackEdits;
  readonly #audition: Audition;
  readonly #feedback: ControlsFeedback;

  constructor(session: Session, edits: TrackEdits, audition: Audition, feedback: ControlsFeedback) {
    this.#session = session;
    this.#edits = edits;
    this.#audition = audition;
    this.#feedback = feedback;
  }

  /** `pattern` null plays the manifest's preview; a named one plays as Add writes it. */
  preview(instrument: string, sound: string | null, pattern: string | null = null): void {
    if (this.#audition.play(instrument, sound, pattern)) this.#feedback.announce(announcements.previewing(instrument, sound));
  }

  stopPreview(): void {
    this.#audition.stop();
  }

  addTrack(instrument: string, sound: string | null, pattern: string | null = null): string {
    this.#audition.stop();
    const result = this.#edits.addTrack(instrument, sound, pattern);
    if (!this.#feedback.report(result) || !result.ok) return "";
    this.#feedback.noteChange(result.name, "track", "added");
    return result.name;
  }

  /** The empty state's starters: one tap adds the instrument and plays. */
  startWithSound(instrument: string): string {
    this.#audition.stop();
    const result = startWithSound(this.#session, this.#edits, instrument);
    if (!this.#feedback.report(result) || !result.ok) return "";
    this.#feedback.noteChange(result.name, "track", "added");
    return result.name;
  }
}
