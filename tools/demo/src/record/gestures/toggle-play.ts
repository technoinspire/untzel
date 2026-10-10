// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Play: the transport's first button.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture } from "../gesture-page";

export const togglePlay: Gesture<Extract<DemoAction, { kind: "togglePlay" }>> = async (page) => {
  await page.getByRole("region", { name: strings.transport, exact: true }).getByRole("button", { name: strings.play, exact: true }).click();
};
