// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import type { MixIntents, SessionIntents, TrackIntents } from "@untzel/skin-contract";
import type { ParameterView, TrackView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { createGainFader } from "../sound/gain-fader";
import { syncRows } from "../sound/parameter-rows";
import type { SliderRow } from "../sound/slider-row";

/** The gain goes to its fader; every other mix parameter is a slider row. */
export function mixParts(mix: readonly ParameterView[]): { readonly gain: ParameterView | undefined; readonly others: readonly ParameterView[] } {
  return { gain: mix.find((parameter) => parameter.name === "gain"), others: mix.filter((parameter) => parameter.name !== "gain") };
}

/** The detail's Mix group: its label, the gain fader and the mix sliders. */
export function createTrackMixGroup(
  intents: MixIntents & Pick<TrackIntents, "setParameter"> & Pick<SessionIntents, "endGesture">,
  name: () => string,
  onRemoved: (what: string) => void,
): { readonly nodes: readonly Node[]; update(track: TrackView): void } {
  const mix = element("div", { className: "ui-detail__params" });
  const gain = createGainFader({
    onPosition: (position) => intents.setParameter(name(), "gain", position),
    onSteps: (steps) => intents.nudgeGain(name(), steps),
    onReset: () => intents.resetGain(name()),
    onEnd: () => intents.endGesture(),
    onSignalReplaced: () => onRemoved(strings.gainSignal),
  });
  const mixRows = new Map<string, SliderRow>();
  return {
    nodes: [element("p", { className: "ui-detail__label", text: text.mix }), gain.root, mix],
    update(track) {
      const parts = mixParts(track.mix);
      gain.root.hidden = parts.gain === undefined;
      if (parts.gain !== undefined) gain.update(parts.gain);
      syncRows(mix, mixRows, parts.others, `ui-mix`, (parameter, fraction) => intents.setParameter(name(), parameter, fraction), () => intents.endGesture());
    },
  };
}
