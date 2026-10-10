// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Song view's intents of the deferred port, with the section rename: forwarded to the
// running controls once the engine runs, dropped before. Part of the initial JS: types only.
import type { RenameIntents, SongIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardSong(running: () => RunningControls | null): SongIntents & Pick<RenameIntents, "renameSection"> {
  return {
    renameSection: (section, newName) => running()?.song.renameSection(section, newName),
    toggleSectionMember: (section, track) => running()?.song.toggleSectionMember(section, track),
    addPartFromPlaying: () => running()?.song.addPartFromPlaying(),
    setPartBars: (part, bars) => running()?.song.setPartBars(part, bars),
    movePart: (part, delta) => running()?.song.movePart(part, delta),
    duplicatePart: (part) => running()?.song.duplicatePart(part),
  };
}
