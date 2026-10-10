// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { parseTemplateHeader } from "./template-header";

describe("template header", () => {
  it("reads the name and the order from the comment lines", () => {
    expect(parseTemplateHeader("// template: Red Earth\n// order: 2\ntempo 123\n")).toEqual({ name: "Red Earth", order: 2, isDefault: false });
    expect(parseTemplateHeader("tempo 124\n//order:7\n//   template:   Night Garden  \n")).toEqual({ name: "Night Garden", order: 7, isDefault: false });
  });

  it("reads the first-touch mark", () => {
    expect(parseTemplateHeader("// template: Midnight Bloom\n// order: 1\n// default: true\n")?.isDefault).toBe(true);
    expect(parseTemplateHeader("// template: x\n// order: 1\n// default: false\n")?.isDefault).toBe(false);
  });

  it("is null when a line is missing or the order is not a number", () => {
    expect(parseTemplateHeader("// template: x\ntempo 124\n")).toBeNull();
    expect(parseTemplateHeader("// order: 1\n")).toBeNull();
    expect(parseTemplateHeader("// template: x\n// order: first\n")).toBeNull();
  });
});
