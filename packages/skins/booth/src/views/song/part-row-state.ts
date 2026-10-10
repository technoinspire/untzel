// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { barsLabel } from "../../behavior/text/format";
import type { SongPartView, SongView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";

// What each row of the Song view shows: the
// part's name, "16 bars · 5 tracks · playing", a bar as long as the part, and how much
// of the playing part has played. Pure, tested without the DOM.

/** The length bar is full from this many bars on. */
export const FULL_LENGTH_BARS = 16;

export type PartRowPlay = "playing" | null;

export interface PartRowState {
  readonly name: string;
  readonly meta: string;
  /** The accessible name: name and meta. */
  readonly label: string;
  readonly play: PartRowPlay;
  readonly isOpen: boolean;
  /** 0..1 of the length bar's track. */
  readonly length: number;
  /** 0..1 of the part already played; 0 unless it is playing. */
  readonly progress: number;
}

export function tracksLabel(count: number): string {
  return phrases.tracks(count);
}

export function partMeta(part: Pick<SongPartView, "bars">, tracks: number, play: PartRowPlay): string {
  const base = `${barsLabel(part.bars)} · ${tracksLabel(tracks)}`;
  if (play === null) return base;
  return `${base} · ${strings.playing}`;
}

export function partRowStates(song: SongView, openPart: number | null): readonly PartRowState[] {
  return song.parts.map((part, index) => {
    const tracks = song.sections.find((section) => section.name === part.section)?.tracks.length ?? 0;
    const isPlaying = index === song.currentPart;
    const play: PartRowPlay = isPlaying ? "playing" : null;
    const meta = partMeta(part, tracks, play);
    const played = isPlaying && song.playheadBar !== null ? (song.playheadBar - part.start) / part.bars : 0;
    return {
      name: part.section,
      meta,
      label: `${part.section}, ${meta}`,
      play,
      isOpen: index === openPart,
      length: Math.min(part.bars, FULL_LENGTH_BARS) / FULL_LENGTH_BARS,
      progress: Math.min(1, Math.max(0, played)),
    };
  });
}
