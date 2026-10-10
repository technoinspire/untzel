// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Steps per bar: one of the three buttons of the detail.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture } from "../../gesture-page";
import { openTrack } from "../track-panel";

export const setStepCount: Gesture<Extract<DemoAction, { kind: "setStepCount" }>> = async (page, action, context) => {
  const detail = await openTrack(page, action.track, context);
  await detail.getByRole("group", { name: strings.stepsPerBar, exact: true }).getByRole("button", { name: strings.stepsPerBarOf(action.count), exact: true }).click();
};
