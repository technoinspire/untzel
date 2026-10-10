// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A value on the track's detail: a slider, the gain fader's arrows, an effect added from the
// Effects row; or, when no position writes the template's value, typed at the end of the
// track's line in the Code panel (parameter-gesture.ts).
import { effectLabels, liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import { codeTarget } from "../../../script/replay";
import type { Gesture } from "../../gesture-page";
import { parameterGesture, writtenModifiers } from "./parameter-gesture";
import { manifestOf, openTrack } from "../track-panel";
import { typeAt } from "../type-code";


export const setParameter: Gesture<Extract<DemoAction, { kind: "setParameter" }>> = async (page, action, context) => {
  const gesture = parameterGesture(manifestOf(action.track, context), action.parameter, action.value, writtenModifiers(action.track, context.source, context.registry));
  if (gesture.kind === "code") {
    const target = codeTarget(context.source, { kind: "trackEnd", track: action.track }, context.registry);
    if (typeof target === "string") throw new Error(`setParameter: ${target}`);
    await typeAt(page, context, target, gesture.text);
    return;
  }
  const detail = await openTrack(page, action.track, context);
  if (gesture.kind === "gain") {
    // Arrows on the focused fader, 0.5 dB each; a click would move it to the pointer. A
    // double click writes 0 dB, gain 1.
    const fader = detail.getByRole("slider", { name: "gain", exact: true });
    if (gesture.arrows === 0) await fader.dblclick();
    for (let press = 0; press < Math.abs(gesture.arrows); press += 1) await fader.press(gesture.arrows > 0 ? "ArrowUp" : "ArrowDown");
    return;
  }
  if (gesture.addEffect !== null) {
    await detail.getByRole("button", { name: strings.addEffectNamed(effectLabels[gesture.addEffect]), exact: true }).click();
  }
  if (gesture.kind === "slider") await detail.getByRole("slider", { name: gesture.slider, exact: true }).fill(String(gesture.position));
};
