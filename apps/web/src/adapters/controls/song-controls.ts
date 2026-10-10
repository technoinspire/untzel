// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { RenameIntents, SongIntents } from "@untzel/skin-contract";
import type { CommandResult, NamedCommandResult, Session, SongEdits, TrackEdits } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";

/** The Song view: a part's tracks, length, order and copies. */
export class SongControls implements SongIntents, Pick<RenameIntents, "renameSection"> {
  readonly #session: Session;
  readonly #edits: TrackEdits;
  readonly #song: SongEdits;
  readonly #feedback: ControlsFeedback;

  constructor(session: Session, edits: TrackEdits, song: SongEdits, feedback: ControlsFeedback) {
    this.#session = session;
    this.#edits = edits;
    this.#song = song;
    this.#feedback = feedback;
  }


  toggleSectionMember(section: string, track: string): void {
    const current = this.#session.view().sections.find((entry) => entry.name === section);
    if (current === undefined) return;
    this.#report(this.#edits.setSectionMembership(section, track, !current.tracks.includes(track)));
  }

  addPartFromPlaying(): void {
    const result = this.#song.addPartFromPlaying();
    if (this.#report(result) && result.ok) this.#feedback.announce(announcements.partAdded(result.name));
  }

  setPartBars(part: number, bars: number): void {
    const section = this.#session.view().song?.parts[part]?.section;
    if (this.#report(this.#song.setPartBars(part, bars)) && section !== undefined) {
      this.#feedback.announce(announcements.partLength(section, bars));
    }
  }

  movePart(part: number, delta: -1 | 1): void {
    const section = this.#session.view().song?.parts[part]?.section;
    if (this.#report(this.#song.movePart(part, delta)) && section !== undefined) {
      this.#feedback.announce(announcements.partMoved(section, part + delta + 1));
    }
  }

  duplicatePart(part: number): void {
    const section = this.#session.view().song?.parts[part]?.section;
    if (this.#report(this.#song.duplicatePart(part)) && section !== undefined) {
      this.#feedback.announce(announcements.partDuplicated(section));
    }
  }

  /** The section line and every use in the song follow, in one edit. */
  renameSection(section: string, newName: string): void {
    this.#report(this.#song.renameSection(section, newName));
  }

  /** The two refusals a person can cause get their own words; the rest their code. */
  #report(result: CommandResult | NamedCommandResult): boolean {
    if (!result.ok && result.code === "SECTION_WOULD_BE_EMPTY") {
      this.#feedback.announce(announcements.partNeedsTrack);
      return false;
    }
    if (!result.ok && result.code === "NOTHING_PLAYING") {
      this.#feedback.announce(announcements.nothingPlaying);
      return false;
    }
    return this.#feedback.report(result);
  }
}
