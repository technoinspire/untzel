// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Length: the transport's chip opens the loop's picker; the length is one of its buttons.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture } from "../gesture-page";
import { PICKER_BARS } from "./track/set-track-bars";
import { startingWith } from "./track-panel";

export const setLoopBars: Gesture<Extract<DemoAction, { kind: "setLoopBars" }>> = async (page, action) => {
  if (!PICKER_BARS.includes(action.bars)) throw new Error(`the loop length picker has no ${action.bars} bars`);
  await page.getByRole("button", { name: startingWith(`${strings.loopLength} `) }).first().click();
  const picker = page.getByRole("dialog", { name: strings.loopLength, exact: true });
  await picker.getByRole("button", { name: strings.barCount(action.bars), exact: true }).click();
};
