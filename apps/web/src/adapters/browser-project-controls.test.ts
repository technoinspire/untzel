// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { projectSummary } from "./browser-project-controls";

const { registry } = buildRegistry();

describe("projectSummary", () => {
  it("reads the tempo and the track count of a text that analyzes", () => {
    expect(projectSummary('title "Two"\ntempo 124\nkick: kick x...\nhat: hat ..x.\n', registry)).toBe("124 BPM · 2 tracks");
  });

  it("is null for a text that does not analyze", () => {
    expect(projectSummary("tempo\n", registry)).toBeNull();
  });
});
