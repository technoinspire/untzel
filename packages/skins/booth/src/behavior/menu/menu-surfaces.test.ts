// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { deletedTitle } from "./menu-surfaces";
import type { UntzelView } from "@untzel/presentation/view-model";
import { viewFixture } from "../../testing/view-fixture";
const view: UntzelView = {
  ...viewFixture(),
  project: {
    ...viewFixture().project,
    title: "Midnight Coast",
    projects: [{ id: "b", title: "Night Drive", edited: "", detail: null, isOpen: false }],
  },
};
describe("deletedTitle", () => {
  it("names the open project, or the stored one the sheet deletes", () => {
    expect(deletedTitle(view, null)).toBe("Midnight Coast");
    expect(deletedTitle(view, "b")).toBe("Night Drive");
    expect(deletedTitle(view, "gone")).toBe("");
  });
});
