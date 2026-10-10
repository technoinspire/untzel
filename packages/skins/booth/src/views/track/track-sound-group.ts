// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import type { MixIntents, SessionIntents, SoundIntents, TrackIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { createEffectsList } from "../sound/effects-list";
import { syncRows } from "../sound/parameter-rows";
import type { SliderRow } from "../sound/slider-row";
import { createSoundGroupHeader } from "../sound/sound-group-header";
import { createSoundPicker } from "../sound/sound-picker";
import { createToneRow } from "../sound/tone-row";
import { toneRemovedSubject } from "../sound/tone-row-model";

export interface TrackSoundGroup {
  readonly nodes: readonly Node[];
  /** Change sound, where the library returns focus. */
  readonly changeSound: HTMLButtonElement;
  /** The header and the tone, drawn before the steps. */
  updateHeader(track: TrackView): void;
  /** The sound picker, the sound sliders and the effects, drawn after the steps. */
  updateBody(track: TrackView): void;
}

/** The detail's Sound group: header, sound picker, sound sliders, tone and effects. */
export function createTrackSoundGroup(
  intents: SoundIntents & Pick<TrackIntents, "setParameter" | "setTone"> & Pick<MixIntents, "useTone"> & Pick<SessionIntents, "endGesture">,
  name: () => string,
  onChangeSound: () => void,
  onRemoved: (what: string) => void,
): TrackSoundGroup {
  const sound = element("div", { className: "ui-detail__params" });
  const soundHead = createSoundGroupHeader(onChangeSound);
  const tone = createToneRow({
    onTone: (fraction) => intents.setTone(name(), fraction),
    onUseTone: () => {
      const removed = intents.useTone(name());
      if (removed.length > 0) onRemoved(toneRemovedSubject(removed));
    },
    onEnd: () => intents.endGesture(),
  });
  const soundRows = new Map<string, SliderRow>();
  const soundPicker = createSoundPicker(intents);
  const effects = createEffectsList(intents);
  return {
    nodes: [soundHead.root, soundPicker.root, sound, tone.root, element("p", { className: "ui-detail__label", text: text.effects }), effects.root],
    changeSound: soundHead.changeSound,
    updateHeader(track) {
      soundHead.update(track);
      tone.root.hidden = !track.hasTone;
      tone.update(track.tone, track.toneSetBy);
    },
    updateBody(track) {
      soundPicker.update(track);
      syncRows(sound, soundRows, track.sound, `ui-sound`, (parameter, fraction) => intents.setParameter(name(), parameter, fraction), () => intents.endGesture());
      effects.update(track);
    },
  };
}
