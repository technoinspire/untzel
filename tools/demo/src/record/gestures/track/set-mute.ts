// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Mute: on a desktop, the track's M in the list of tracks, pressed or not; on a phone, where
// the list has no M, a tap on the track's tile, which is pressed while the track plays.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture } from "../../gesture-page";
import { reveal, startingWith } from "../track-panel";

export const setMute: Gesture<Extract<DemoAction, { kind: "setMute" }>> = async (page, action, context) => {
  if (context.isPhone) {
    const tile = await reveal(page, page.getByRole("region", { name: strings.tracks, exact: true }).getByRole("button", { name: startingWith(`${action.track}, `) }).first(), true);
    if (((await tile.getAttribute("aria-pressed")) === "true") !== action.muted) return;
    await tile.click();
    return;
  }
  const mute = page.getByRole("button", { name: strings.muteTrack(action.track), exact: true }).first();
  if (((await mute.getAttribute("aria-pressed")) === "true") === action.muted) return;
  await mute.click();
};
