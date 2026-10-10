// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { LibraryIntents, PatternIntents, SoundIntents } from "@untzel/skin-contract";
import type { LibraryMode } from "../../behavior/library/library-mode";
import type { AuditionView, UntzelView } from "@untzel/presentation/view-model";
import type { LibraryRowActions } from "./library-row";

export interface LibrarySheetCallbacks {
  readonly onClose: () => void;
  readonly onAdded: (track: string) => void;
  /** Change sound wrote the new sound: back to the track detail. */
  readonly onSoundChanged: (track: string) => void;
}

/** In replace mode what plays is the track itself (a track preview), not the library's audition. */
export function auditionOf(view: Pick<UntzelView, "audition" | "transport">, mode: LibraryMode): AuditionView | null {
  if (mode.kind === "add") return view.audition;
  const sound = mode.track.previewingSound;
  return sound === null ? null : { instrument: sound.instrument, sound: sound.sound, key: view.transport.key, pattern: null };
}

/** What a row does in each mode: add a track from the library, or change the sound of the track. */
export function rowActions(mode: LibraryMode, intents: LibraryIntents & SoundIntents & PatternIntents, callbacks: LibrarySheetCallbacks): LibraryRowActions {
  if (mode.kind === "add") {
    return {
      mode,
      preview: (instrument, sound, pattern) => intents.preview(instrument, sound, pattern),
      stop: () => intents.stopPreview(),
      choose: (instrument, sound, pattern) => {
        const track = intents.addTrack(instrument, sound, pattern);
        if (track !== "") callbacks.onAdded(track);
      },
    };
  }
  const track = mode.track.name;
  return {
    mode,
    preview: (instrument, sound) => intents.previewTrackSound(track, instrument, sound),
    stop: () => intents.endTrackPreview(),
    choose: (instrument, sound) => {
      intents.setTrackSound(track, instrument, sound);
      callbacks.onSoundChanged(track);
    },
  };
}
