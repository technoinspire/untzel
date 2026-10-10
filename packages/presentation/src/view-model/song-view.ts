// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song: its sections, its parts in order and where the playhead is.

export interface SectionView {
  readonly name: string;
  readonly tracks: readonly string[];
}

export interface SongPartView {
  readonly section: string;
  readonly bars: number;
  /** First bar of the part in one pass of the song, 0-based. */
  readonly start: number;
}

export interface SongView {
  readonly sections: readonly SectionView[];
  readonly parts: readonly SongPartView[];
  readonly currentPart: number | null;
  /** 0-based bar of the song, fractional; null outside song mode. */
  readonly playheadBar: number | null;
}
