// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A track into a section, in song mode: the part of the song that plays the section opens
// its editor, where each track is a toggle.
import { livePhrases as phrases, liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture } from "../gesture-page";
import { closeCode, startingWith } from "./track-panel";

export const addSectionMember: Gesture<Extract<DemoAction, { kind: "addSectionMember" }>> = async (page, action) => {
  const toggle = page.getByRole("button", { name: phrases.trackInPart(action.track, action.section), exact: true });
  if (!(await toggle.isVisible())) {
    await closeCode(page);
    const parts = page.getByRole("list", { name: strings.parts, exact: true });
    await parts.getByRole("button", { name: startingWith(`${action.section}, `) }).first().click();
  }
  await toggle.click();
};
