// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { createSpokenText } from "./spoken-text";
describe("createSpokenText", () => {
  it("says a line only when it changes", () => {
    const said: string[] = [];
    const line = createSpokenText((message) => said.push(message));
    line.say("Editing bar 1 of 4");
    line.say("Editing bar 1 of 4");
    line.say("Editing bar 2 of 4");
    expect(said).toEqual(["Editing bar 1 of 4", "Editing bar 2 of 4"]);
  });
  it("a settled line is not said, and an empty line is silent", () => {
    const said: string[] = [];
    const line = createSpokenText((message) => said.push(message));
    line.settle("Editing bar 1 of 4");
    line.say("Editing bar 1 of 4");
    line.say("");
    line.say("Rest");
    expect(said).toEqual(["Rest"]);
  });
});
