// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Drop: the transport's red button; every muted track comes in on the next bar.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture } from "../gesture-page";

export const drop: Gesture<Extract<DemoAction, { kind: "drop" }>> = async (page) => {
  await page.getByRole("button", { name: strings.drop, exact: true }).click();
};
