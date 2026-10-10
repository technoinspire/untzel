// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes } from "../dom";
import { icon } from "../icons";
import type { TrackView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";

// The head of the Sound group of the track detail: its label and Change sound, which
// opens the library in replace mode for this track.

export interface SoundGroupHeader {
  readonly root: HTMLElement;
  readonly changeSound: HTMLButtonElement;
  update(track: TrackView): void;
}

/** "Change sound of ride, now hat closed". */
export function changeSoundLabel(track: TrackView): string {
  return strings.changeSoundOf(track.name, `${track.instrument} ${track.preset}`.trimEnd());
}

export function createSoundGroupHeader(onChangeSound: () => void): SoundGroupHeader {
  const changeSound = button("ui-pill ui-pill--raised ui-sound__change", text.changeSound, onChangeSound, [icon("swap"), element("span", { text: text.changeSound })]);
  const root = element("div", { className: "ui-sound__head" }, [element("p", { className: "ui-detail__label", text: text.sound }), changeSound]);
  return {
    root,
    changeSound,
    update(track) {
      setAttributes(changeSound, { "aria-label": changeSoundLabel(track) });
    },
  };
}
