// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { strings } from "../../copy/copy";
import { toneRoleText } from "./slider-row";
describe("toneRoleText", () => {
  it("tags a parameter that tone moves", () => {
    expect(toneRoleText("overrides")).toBe(strings.overridesTone);
    expect(toneRoleText("follows")).toBe(strings.followsTone);
  });
  it("tags nothing else", () => {
    expect(toneRoleText(null)).toBe("");
  });
});
