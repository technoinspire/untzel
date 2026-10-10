// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setText } from "../dom";
import { translator } from "../../copy/copy";
import { icon } from "../icons";
import type { SoundIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { soundButtonLabel } from "../../behavior/text/sound-labels";

export interface SoundPicker {
  readonly root: HTMLElement;
  update(track: TrackView): void;
}

/**
 * The first row of the Sound group: `Sound <preset>` opens a list of the
 * instrument's sounds with their descriptions; picking one rewrites the sound word.
 */
/** The sound an option writes: the first is the instrument's default, written as no sound. */
export function soundOfOption(index: number, name: string): string | null {
  return index === 0 ? null : name;
}

export function createSoundPicker(intents: SoundIntents): SoundPicker {
  let current: TrackView | null = null;
  const label = element("span", { className: "ui-sound-picker__label" });
  const toggle = button("ui-pill ui-pill--raised ui-sound-picker__toggle", "", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"), [label, icon("chevron")]);
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", "false");
  const list = element("ul", { className: "ui-sound-picker__list", attributes: { role: "listbox", hidden: true } });
  const root = element("div", { className: "ui-sound-picker" }, [toggle, list]);
  const setOpen = (open: boolean): void => {
    list.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  let key = "";
  return {
    root,
    update(track) {
      current = track;
      const nextKey = `${translator.locale()}|${track.name}|${track.preset}|${track.presets.map((sound) => sound.name).join(",")}`;
      root.hidden = track.presets.length < 2;
      if (nextKey === key) return;
      key = nextKey;
      setText(label, soundButtonLabel(track.preset));
      toggle.setAttribute("aria-label", soundButtonLabel(track.preset));
      list.replaceChildren(...track.presets.map((sound, index) => {
        const option = button("ui-sound-picker__option", sound.name, () => {
          if (current !== null) intents.setSound(current.name, soundOfOption(index, sound.name));
          setOpen(false);
        }, [element("span", { className: "ui-sound-picker__name", text: sound.name }), element("span", { className: "ui-sound-picker__description", text: sound.description })]);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(sound.name === track.preset));
        return element("li", {}, [option]);
      }));
    },
  };
}
