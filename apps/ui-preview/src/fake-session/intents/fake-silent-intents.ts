// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The intents the preview has no engine and no language for: the touched note, the sound
// group, the pattern chips, the tempo and the key. The real app's browser tests exercise
// them; the preview keeps its screens reachable and says what would happen.

import type { AuditionIntents, PatternIntents, SoundIntents, StatementIntents } from "@untzel/skin-contract";
import type { FakeState } from "../fake-state";

export function fakeSilentIntents(state: FakeState): AuditionIntents & SoundIntents & PatternIntents & StatementIntents {
  return {
    // The preview has no sound engine: a touched note stays silent here.
    audition: () => undefined,
    setSound: () => undefined,
    addEffect: () => undefined,
    removeEffect: () => undefined,
    previewTrackSound: () => undefined,
    setTrackSound: () => undefined,
    previewPattern: () => undefined,
    usePattern: () => undefined,
    endTrackPreview: () => undefined,
    setTempo: (bpm) => state.announce(`Tempo ${bpm} BPM from the next bar.`),
    setKey: (tonic, scale) => state.announce(`Key ${tonic} ${scale} from the next bar.`),
  };
}
