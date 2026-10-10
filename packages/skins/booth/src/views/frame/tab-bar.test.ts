// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { readLabel } from "../../copy/copy";
import { TABS, TAB_LABELS } from "./tab-bar";
describe("the phone's navigation", () => {
  it("has Tracks and Song, and no Code", () => {
    expect(TABS.map((tab) => readLabel(TAB_LABELS[tab]))).toEqual(["Tracks", "Song"]);
  });
});
