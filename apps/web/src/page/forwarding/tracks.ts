// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The track's intents of the deferred port (steps, bars, mix, rename, the end of a
// gesture): forwarded to the running controls once the engine runs, dropped before. Part of
// the initial JS: types only.
import type { BarIntents, MixIntents, RenameIntents, SessionIntents, TrackIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

type ForwardedTrackIntents = TrackIntents & BarIntents & MixIntents & Pick<RenameIntents, "renameTrack"> & Pick<SessionIntents, "endGesture">;

export function forwardTracks(running: () => RunningControls | null): ForwardedTrackIntents {
  return {
    endGesture: () => running()?.tracks.endGesture(),
    toggleTrack: (track) => running()?.tracks.toggleTrack(track),
    setSolo: (track, isSoloed) => running()?.tracks.setSolo(track, isSoloed),
    setMute: (track, isMuted) => running()?.tracks.setMute(track, isMuted),
    setTone: (track, tone) => running()?.tracks.setTone(track, tone),
    toggleStep: (track, bar, step) => running()?.tracks.toggleStep(track, bar, step),
    setStepPitch: (track, bar, step, pitch) => running()?.tracks.setStepPitch(track, bar, step, pitch),
    setScaleLock: (track, isLocked) => running()?.tracks.setScaleLock(track, isLocked),
    setStepCount: (track, count) => running()?.tracks.setStepCount(track, count),
    setBars: (track, bars) => running()?.tracks.setBars(track, bars),
    setParameter: (track, parameter, fraction) => running()?.tracks.setParameter(track, parameter, fraction),
    copyBar: (track, bar) => running()?.tracks.copyBar(track, bar) ?? false,
    pasteBar: (track, bar) => running()?.tracks.pasteBar(track, bar),
    clearBar: (track, bar) => running()?.tracks.clearBar(track, bar),
    duplicateTrack: (track) => running()?.tracks.duplicateTrack(track) ?? track,
    renameTrack: (track, newName) => running()?.tracks.renameTrack(track, newName),
    useTone: (track) => running()?.tracks.useTone(track) ?? [],
    nudgeGain: (track, steps) => running()?.tracks.nudgeGain(track, steps),
    resetGain: (track) => running()?.tracks.resetGain(track),
    deleteTrack: (track) => running()?.tracks.deleteTrack(track),
  };
}
