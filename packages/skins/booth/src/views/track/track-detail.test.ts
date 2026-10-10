// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { createPreviewSoundsSetting } from "../../behavior/preferences/preview-sounds-setting";
import { shouldAudition } from "./track-detail";
describe("the track detail's Preview sounds", () => {
  it("follows the shared setting at each touch: off by the menu, the next step is silent", () => {
    const setting = createPreviewSoundsSetting(null);
    const sound = { kind: "note" };
    expect(shouldAudition(setting.isOn(), sound)).toBe(true);
    setting.set(false);
    expect(shouldAudition(setting.isOn(), sound)).toBe(false);
    setting.set(true);
    expect(shouldAudition(setting.isOn(), sound)).toBe(true);
    expect(shouldAudition(true, null)).toBe(false);
  });
});
