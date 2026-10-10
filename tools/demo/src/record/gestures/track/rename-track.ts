// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Rename: the track's name in its detail turns into a field; the new name typed over the
// old one, and Enter.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture } from "../../gesture-page";
import { openTrack } from "../track-panel";

export const renameTrack: Gesture<Extract<DemoAction, { kind: "renameTrack" }>> = async (page, action, context) => {
  const detail = await openTrack(page, action.track, context);
  await detail.getByRole("button", { name: action.track, exact: true }).click();
  // While the name is edited the dialog's name changes: the field is found on the page.
  const field = page.getByRole("textbox", { name: strings.trackNameField, exact: true });
  await field.press("ControlOrMeta+a");
  await field.pressSequentially(action.newName);
  await field.press("Enter");
};
