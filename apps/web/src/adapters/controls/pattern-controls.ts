// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PatternIntents } from "@untzel/skin-contract";
import type { PatternEdits, Session } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";

/** The pattern chips of the track detail: preview in the music, then write. */
export class PatternControls implements PatternIntents {
  readonly #session: Session;
  readonly #edits: PatternEdits;
  readonly #feedback: ControlsFeedback;

  constructor(session: Session, edits: PatternEdits, feedback: ControlsFeedback) {
    this.#session = session;
    this.#edits = edits;
    this.#feedback = feedback;
  }

  previewPattern(track: string, pattern: string): void {
    if (this.#feedback.report(this.#edits.preview(track, pattern))) this.#feedback.announce(announcements.patternPreview(track, pattern));
  }

  usePattern(track: string, pattern: string): void {
    if (this.#feedback.report(this.#edits.setTrackPattern(track, pattern))) this.#feedback.noteChange(track, "pattern", pattern);
  }

  endTrackPreview(): void {
    this.#session.endTrackPreview();
  }
}
