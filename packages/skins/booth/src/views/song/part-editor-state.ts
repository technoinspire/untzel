// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { barsLabel } from "../../behavior/text/format";
import type { UntzelView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";

// What the part editor shows: its name, where
// it sits in the song, its length, which tracks play in it, and which actions work now.
// Pure, tested without the DOM.

export interface TrackToggleState {
  readonly track: string;
  readonly label: string;
  /** The accessible name: "kick in drop". */
  readonly name: string;
  readonly isMember: boolean;
}

export interface PartEditorState {
  readonly section: string;
  /** "part 3 of 6 · bars 13–28". */
  readonly meta: string;
  /** Set when the section plays in more than one part: its tracks change in each. */
  readonly shared: string | null;
  readonly lengthLabel: string;
  readonly lengthName: string;
  readonly tracks: readonly TrackToggleState[];
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export function partEditorState(view: UntzelView, index: number): PartEditorState | null {
  const { parts, sections } = view.song;
  const part = parts[index];
  if (part === undefined) return null;
  const members = sections.find((section) => section.name === part.section)?.tracks ?? [];
  const uses = parts.filter((entry) => entry.section === part.section).length;
  return {
    section: part.section,
    meta: phrases.partPosition(index + 1, parts.length, part.start + 1, part.start + part.bars),
    shared: uses > 1 ? phrases.partShared(uses) : null,
    lengthLabel: barsLabel(part.bars),
    lengthName: phrases.lengthName(strings.partLength, part.bars),
    tracks: view.tracks.map((track) => {
      const isMember = members.includes(track.name);
      return {
        track: track.name,
        label: isMember ? track.name : phrases.trackOff(track.name),
        name: phrases.trackInPart(track.name, part.section),
        isMember,
      };
    }),
    canMoveUp: index > 0,
    canMoveDown: index < parts.length - 1,
  };
}
