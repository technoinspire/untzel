// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Pattern length: the chip of the detail opens its picker; the length is one of its buttons.
import { livePhrases as phrases, liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture } from "../../gesture-page";
import { openTrack, startingWith } from "../track-panel";

/** The lengths the picker offers; another one is typed in the Code panel. */
export const PICKER_BARS: readonly number[] = [1, 2, 4, 8, 16];

export const setTrackBars: Gesture<Extract<DemoAction, { kind: "setTrackBars" }>> = async (page, action, context) => {
  if (!PICKER_BARS.includes(action.bars)) throw new Error(`the pattern length picker has no ${action.bars} bars`);
  const detail = await openTrack(page, action.track, context);
  await detail.getByRole("button", { name: startingWith(`${strings.patternLength} `) }).click();
  const picker = page.getByRole("dialog", { name: phrases.lengthTitle(strings.patternLength, action.track), exact: true });
  await picker.getByRole("button", { name: strings.barCount(action.bars), exact: true }).click();
};
