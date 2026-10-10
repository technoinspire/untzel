// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Song view's intents of the fake session: parts in playing order, the tracks of each
// part, and the section rename (said, not written).

import type { RenameIntents, SongIntents } from "@untzel/skin-contract";
import type { SongPartView } from "@untzel/presentation/view-model";
import type { FakeState } from "../fake-state";

/** The parts with their starts counted again, like the session's song view. */
function setParts(state: FakeState, parts: readonly SongPartView[]): void {
  let start = 0;
  state.parts = parts.map((part) => {
    const placed = { ...part, start };
    start += part.bars;
    return placed;
  });
  state.emit();
}

function toggleSectionMember(state: FakeState, section: string, track: string): void {
  const target = state.sections.find((entry) => entry.name === section);
  if (target === undefined) return;
  target.tracks = target.tracks.includes(track) ? target.tracks.filter((name) => name !== track) : [...target.tracks, track];
  state.emit();
}

function addPartFromPlaying(state: FakeState): void {
  const playing = state.tracks.filter((track) => track.isOn && !track.isMuted).map((track) => track.name);
  let name = "part";
  for (let index = 2; state.sections.some((section) => section.name === name); index += 1) name = `part${index}`;
  state.sections.push({ name, tracks: playing });
  setParts(state, [...state.parts, { section: name, bars: state.fixture.loopBars, start: 0 }]);
  state.announce(`${name} added at the end of the song.`);
}

function movePart(state: FakeState, part: number, delta: -1 | 1): void {
  const parts = [...state.parts];
  const moved = parts[part];
  const other = parts[part + delta];
  if (moved === undefined || other === undefined) return;
  parts[part] = other;
  parts[part + delta] = moved;
  setParts(state, parts);
}

function duplicatePart(state: FakeState, part: number): void {
  const copy = state.parts[part];
  if (copy === undefined) return;
  setParts(state, [...state.parts.slice(0, part + 1), copy, ...state.parts.slice(part + 1)]);
}

export function fakeSong(state: FakeState): SongIntents & Pick<RenameIntents, "renameSection"> {
  return {
    renameSection: (section, newName) => state.announce(`Renamed ${section} to ${newName}.`),
    toggleSectionMember: (section, track) => toggleSectionMember(state, section, track),
    addPartFromPlaying: () => addPartFromPlaying(state),
    setPartBars: (part, bars) => setParts(state, state.parts.map((entry, index) => (index === part ? { ...entry, bars } : entry))),
    movePart: (part, delta) => movePart(state, part, delta),
    duplicatePart: (part) => duplicatePart(state, part),
  };
}
