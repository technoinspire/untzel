// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PlaybackIntents, SongIntents, TrackIntents } from "@untzel/skin-contract";
import { MUSICAL_LENGTHS } from "../../behavior/text/lengths";
import type { UntzelView } from "@untzel/presentation/view-model";
import type { LengthTarget } from "../../shell/navigation";
import { phrases, strings } from "../../copy/copy";

// The texts of the length picker for each chip: the loop, the
// pattern of the track shown in the detail, or the part open in its editor. Pure, so the
// rules are tested without the DOM; lengthChoice adds what a tap does.

export interface LengthChoiceText {
  readonly title: string;
  /** The length written in the text; any number, so an odd one shows as written. */
  readonly current: number;
  /**
   * "Now 6 bars, set in the code" when the length written is none of the five offered,
   * so the picker still says what it is; null otherwise.
   */
  readonly written: string | null;
  readonly note: string;
  /** Where other lengths are written. */
  readonly other: string;
}

export interface LengthSubject {
  readonly target: LengthTarget;
  /** The track the detail shows; the first track when none is chosen. */
  readonly track: string | null;
  readonly part: number | null;
}

/** What the picker chooses now: its texts and what a tap on a length does. */
export interface LengthChoice extends LengthChoiceText {
  readonly pick: (bars: number) => void;
}

/** The intents a pick may send: one per chip. */
export type LengthIntents = Pick<PlaybackIntents, "setLoopBars"> & Pick<TrackIntents, "setBars"> & Pick<SongIntents, "setPartBars">;

/** The texts plus what a tap on a length does: write it, then `onPicked` (the shell closes). */
export function lengthChoice(view: UntzelView, subject: LengthSubject, intents: LengthIntents, onPicked: () => void): LengthChoice | null {
  const text = lengthChoiceText(view, subject);
  if (text === null) return null;
  const track = subject.track ?? view.tracks[0]?.name ?? null;
  const apply = (bars: number): void => {
    if (subject.target === "loop") intents.setLoopBars(bars);
    else if (subject.target === "pattern" && track !== null) intents.setBars(track, bars);
    else if (subject.target === "part" && subject.part !== null) intents.setPartBars(subject.part, bars);
  };
  return {
    ...text,
    pick: (bars) => {
      apply(bars);
      onPicked();
    },
  };
}

/** null when the track or part the picker was opened for is gone. */
export function lengthChoiceText(view: UntzelView, subject: LengthSubject): LengthChoiceText | null {
  const text = baseText(view, subject);
  return text === null ? null : { ...text, written: writtenLength(text.current) };
}

function writtenLength(current: number): string | null {
  const offered: readonly number[] = MUSICAL_LENGTHS;
  return offered.includes(current) ? null : phrases.writtenInCode(current);
}

function baseText(view: UntzelView, subject: LengthSubject): Omit<LengthChoiceText, "written"> | null {
  switch (subject.target) {
    case "loop":
      return { title: strings.loopLength, current: view.transport.loopBars, note: strings.lengthNote, other: strings.loopOther };
    case "pattern": {
      const name = subject.track ?? view.tracks[0]?.name;
      const track = view.tracks.find((entry) => entry.name === name);
      if (track === undefined) return null;
      return { title: phrases.lengthTitle(strings.patternLength, track.name), current: track.bars, note: strings.patternNote, other: strings.patternOther };
    }
    case "part": {
      const part = subject.part === null ? undefined : view.song.parts[subject.part];
      if (part === undefined) return null;
      return { title: phrases.lengthTitle(strings.partLength, part.section), current: part.bars, note: strings.partNote, other: strings.partOther };
    }
  }
}
