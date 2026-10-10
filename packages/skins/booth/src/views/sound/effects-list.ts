// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { text, translator } from "../../copy/copy";
import { button, element } from "../dom";
import { icon } from "../icons";
import type { SoundIntents, TrackIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { addEffectLabel, addableEffects, effectLabel, removeEffectLabel } from "../../behavior/text/sound-labels";
import { createSliderRow, type SliderRow } from "./slider-row";

export interface EffectsList {
  readonly root: HTMLElement;
  update(track: TrackView): void;
}

/**
 * The insert effects in the order they play, each with its sliders and a
 * remove button, then the effects that can still be added. The rows are rebuilt only
 * when the chain changes, so a slider keeps its focus while it is dragged.
 */
export function createEffectsList(intents: SoundIntents & Pick<TrackIntents, "setParameter">): EffectsList {
  const list = element("div", { className: "ui-effects__list" });
  const adds = element("div", { className: "ui-effects__add", attributes: { role: "group", "aria-label": text.addEffect } });
  const root = element("div", { className: "ui-effects" }, [list, adds]);
  const rows = new Map<string, SliderRow>();
  let key = "";
  return {
    root,
    update(track) {
      const nextKey = JSON.stringify([translator.locale(), track.name, track.effects.map((effect) => effect.effect)]);
      if (nextKey !== key) {
        key = nextKey;
        rows.clear();
        list.replaceChildren(...track.effects.map((effect) => {
          const sliders = effect.parameters.map((parameter) => {
            const row = createSliderRow(`ui-effect-${track.name}`, parameter.name, (fraction) => intents.setParameter(track.name, parameter.name, fraction));
            rows.set(parameter.name, row);
            return row.root;
          });
          const remove = button("ui-round ui-round--raised ui-effects__remove", removeEffectLabel(effect.effect), () => intents.removeEffect(track.name, effect.effect), [icon("close")]);
          return element("div", { className: "ui-effects__item" }, [
            element("div", { className: "ui-effects__head" }, [element("p", { className: "ui-effects__name", text: effectLabel(effect.effect) }), remove]),
            ...sliders,
          ]);
        }));
        adds.replaceChildren(...addableEffects(track.effects).map((effect) =>
          button("ui-pill ui-pill--chip ui-effects__add-one", addEffectLabel(effect), () => intents.addEffect(track.name, effect), [icon("plus"), element("span", { text: effectLabel(effect) })]),
        ));
      }
      for (const effect of track.effects) for (const parameter of effect.parameters) rows.get(parameter.name)?.update(parameter);
    },
  };
}
