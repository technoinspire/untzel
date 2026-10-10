// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The play range intents over the session's PlayRanges use
// cases: one announcement per change (never per bar or per key), the cut a shorter loop or
// song forces announced once, and the export sheet handed the range that plays so its
// Selected range starts and ends there. Nothing here edits text or decides a bar.
import { partSpanNames, rangePhrases } from "@untzel/skin";
import type { RangeGesture, RangeIntents } from "@untzel/skin-contract";
import type { PlayRanges, PlayRangeResult, PlayRangeView, Session, Unsubscribe } from "@untzel/session";
import { announcements } from "../../strings/copy";
import type { FollowedRange } from "./export/export-request";
import type { ControlsFeedback } from "./feedback";

export interface RangeControlsOptions {
  readonly ranges: PlayRanges;
  readonly session: Session;
  readonly feedback: ControlsFeedback;
  /** The export sheet's seam: the range that plays now, or null. */
  readonly exporter: { followPlayRange(range: FollowedRange | null): void };
}

export class RangeControls implements RangeIntents {
  readonly #options: RangeControlsOptions;
  readonly #unsubscribe: Unsubscribe;
  #announcedNotice = 0;

  constructor(options: RangeControlsOptions) {
    this.#options = options;
    this.#unsubscribe = options.ranges.subscribe(() => this.#onRanges());
    this.#onRanges();
  }

  /** A key on a handle is not said: the slider's value already is. */
  setPlayRange(startBar: number, endBar: number, gesture: RangeGesture): void {
    if (this.#report(this.#options.ranges.set({ kind: "bars", startBar, endBar })) && gesture === "release") this.#announceRange();
  }

  clearPlayRange(): void {
    const mode = this.#options.ranges.view().mode;
    if (this.#report(this.#options.ranges.clear())) this.#options.feedback.announce(announcements.rangeCleared(mode));
  }

  setRangeCycle(cycle: boolean): void {
    if (!this.#report(this.#options.ranges.set({ kind: "cycle", cycle }))) return;
    const range = this.#options.ranges.view().range;
    if (range === null) return;
    this.#options.feedback.announce(cycle ? announcements.cycleOn(range.startBar, range.endBar) : announcements.cycleOff(range.endBar));
  }

  setRangeToPart(part: number): void {
    if (this.#report(this.#options.ranges.set({ kind: "part", partIndex: part }))) this.#announceRange();
  }

  extendRangeToPart(part: number): void {
    if (this.#report(this.#options.ranges.set({ kind: "extendToPart", partIndex: part }))) this.#announceRange();
  }

  playFrom(bar: number): void {
    if (this.#report(this.#options.ranges.playFrom(bar))) this.#options.feedback.announce(announcements.playingFrom(null, bar));
  }

  playFromPart(part: number): void {
    const section = this.#options.session.view().song?.parts[part];
    if (!this.#report(this.#options.ranges.playFromPart(part)) || section === undefined) return;
    this.#options.feedback.announce(announcements.playingFrom(section.section, section.start + 1));
  }

  playPart(part: number): void {
    const section = this.#options.session.view().song?.parts[part]?.section;
    if (!this.#report(this.#options.ranges.playPart(part)) || section === undefined) return;
    const range = this.#options.ranges.view().range;
    this.#options.feedback.announce(range === null ? announcements.rangeCleared("song") : announcements.partRepeats(section));
  }

  dispose(): void {
    this.#unsubscribe();
  }

  #announceRange(): void {
    const range = this.#options.ranges.view().range;
    if (range !== null) this.#options.feedback.announce(announcements.rangeSet(range.startBar, range.endBar));
  }

  #report(result: PlayRangeResult): boolean {
    if (!result.ok) this.#options.feedback.announce(announcements.failed(result.code));
    return result.ok;
  }

  #onRanges(): void {
    const view = this.#options.ranges.view();
    const notice = view.notice;
    if (notice !== null && notice.id > this.#announcedNotice) {
      this.#announcedNotice = notice.id;
      this.#options.feedback.announce(announcements.rangeClamped(notice.mode, notice.lastBar, notice.range.startBar, notice.range.endBar));
    }
    this.#options.exporter.followPlayRange(followed(view));
  }
}

/** What the export sheet follows: the range of the mode asked for, with "Bars 9–28 · build → drop". */
export function followed(view: PlayRangeView): FollowedRange | null {
  const range = view.range;
  if (range === null) return null;
  const names = view.mode === "song" && view.songNames !== null ? partSpanNames(view.songNames) : null;
  return { mode: view.mode, startBar: range.startBar, endBar: range.endBar, label: rangePhrases.exportRange(range.startBar, range.endBar, names) };
}
