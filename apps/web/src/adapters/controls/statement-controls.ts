// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { StatementIntents } from "@untzel/skin-contract";
import type { ScaleName } from "@untzel/core";
import type { StatementEdits } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";

/** The transport's tempo and key: both enter on the next bar. */
export class StatementControls implements StatementIntents {
  readonly #edits: StatementEdits;
  readonly #feedback: ControlsFeedback;

  constructor(edits: StatementEdits, feedback: ControlsFeedback) {
    this.#edits = edits;
    this.#feedback = feedback;
  }

  setTempo(bpm: number): void {
    if (this.#feedback.report(this.#edits.setTempo(bpm))) this.#feedback.announce(announcements.tempoNextBar(bpm));
  }

  setKey(tonic: string, scale: ScaleName): void {
    if (this.#feedback.report(this.#edits.setKey(tonic, scale))) this.#feedback.announce(announcements.keyNextBar(`${tonic} ${scale}`));
  }
}
