// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { cardDetailText } from "./template-cards";
describe("cardDetailText", () => {
  it("follows the name with the tempo and key", () => {
    expect(cardDetailText("124 BPM · c minor")).toBe(" · 124 BPM · c minor");
  });
  it("adds nothing to a card without detail", () => {
    expect(cardDetailText(null)).toBe("");
  });
});
