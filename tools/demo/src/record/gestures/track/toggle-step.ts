// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A tap on the step grid. A drum step toggles; a pitched step opens the note picker, where
// the step becomes a rest (the only toggle the script asks of a pitched track).
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture } from "../../gesture-page";
import { manifestOf, openTrack, showBar, stepButton } from "../track-panel";

export const toggleStep: Gesture<Extract<DemoAction, { kind: "toggleStep" }>> = async (page, action, context) => {
  const detail = await openTrack(page, action.track, context);
  const grid = await showBar(detail, action.track, action.bar);
  await stepButton(grid, action.step).click();
  if (manifestOf(action.track, context).kind === "drum") return;
  await detail.getByRole("group", { name: strings.stepIs, exact: true }).getByRole("button", { name: strings.pitchRest, exact: true }).click();
};
