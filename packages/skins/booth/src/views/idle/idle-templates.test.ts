// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { continueLabel } from "./idle-templates";
describe("the waiting screen's templates", () => {
  it("offers to continue the most recent project by its title", () => {
    expect(continueLabel({ id: "a", title: "Night Drive" })).toBe("Continue Night Drive");
    expect(continueLabel(null)).toBeNull();
  });
});
