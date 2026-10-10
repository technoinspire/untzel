// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PlaybackIntents } from "@untzel/skin-contract";
import type { HistoryResult, PlaybackMode, Session, TrackEdits } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { ControlsFeedback } from "./feedback";
import type { UndoNotice } from "@untzel/presentation/view-model";

export interface PlaybackControlsOptions {
  readonly session: Session;
  readonly edits: TrackEdits;
  readonly feedback: ControlsFeedback;
  /** Called synchronously inside the play gesture, before the session plays. */
  readonly resumeAudio: () => void;
}

/** Play, stop, mode, drop, loop length and the text history. */
export class PlaybackControls implements PlaybackIntents {
  readonly #options: PlaybackControlsOptions;

  constructor(options: PlaybackControlsOptions) {
    this.#options = options;
  }

  togglePlay(): void {
    const { session, feedback, resumeAudio } = this.#options;
    if (session.view().playing) {
      this.stop();
      return;
    }
    resumeAudio();
    if (session.play(session.view().mode ?? "loop").ok) feedback.announce(announcements.playing);
  }

  stop(): void {
    this.#options.session.stop();
    this.#options.feedback.announce(announcements.stopped);
  }

  setMode(mode: PlaybackMode): void {
    const { session, feedback } = this.#options;
    if (!session.setMode(mode).ok) {
      feedback.announce(announcements.songUnavailable);
      return;
    }
    feedback.announce(mode === "song" ? announcements.songNextPhrase : announcements.loopNextPhrase);
  }

  drop(): void {
    const { edits, feedback } = this.#options;
    if (feedback.report(edits.drop())) feedback.announce(announcements.drop);
  }

  /** `loop <bars>`: the new length enters on the next bar; the music never stops. */
  setLoopBars(bars: number): void {
    const { edits, feedback } = this.#options;
    if (feedback.report(edits.setLoopBars(bars))) feedback.announce(announcements.loopLength(bars));
  }

  /** What the step changed, for the touch Undo's toast. */
  undo(): UndoNotice | null {
    return noticeOf(this.#options.session.undo());
  }

  redo(): UndoNotice | null {
    return noticeOf(this.#options.session.redo());
  }
}

/** Typing has no label: the toast then says "the last change". */
function noticeOf(result: HistoryResult): UndoNotice | null {
  return result.ok && result.label !== null ? { what: result.label.what, target: result.label.target } : null;
}
