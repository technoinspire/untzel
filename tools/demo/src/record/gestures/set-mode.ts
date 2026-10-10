// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Loop or Song: the transport's Mode switch on a desktop; on a phone, the Song view first,
// where the switch lives, with the panel beside the stage closed.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture } from "../gesture-page";
import { reveal } from "./track-panel";

export const setMode: Gesture<Extract<DemoAction, { kind: "setMode" }>> = async (page, action, context) => {
  if (context.isPhone) {
    const views = page.getByRole("navigation", { name: strings.navigation, exact: true });
    await (await reveal(page, views.getByRole("button", { name: strings.song, exact: true }), true)).click();
  }
  const mode = page.getByRole("group", { name: strings.mode, exact: true });
  await mode.getByRole("button", { name: action.mode === "song" ? strings.song : strings.loop, exact: true }).click();
};
