// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { completionKeymap } from "@codemirror/autocomplete";
import { describe, expect, it } from "vitest";
import { completionKeys, HELP_KEY } from "./assist-keys";

describe("the completion keys leave Alt+I to the help", () => {
  it("CodeMirror itself binds Alt+I to the list on a Mac", () => {
    expect(completionKeymap.some((binding) => binding.mac === HELP_KEY)).toBe(true);
  });

  it("no completion binding takes Alt+I, on any platform", () => {
    expect(completionKeys().filter((binding) => binding.key === HELP_KEY || binding.mac === HELP_KEY)).toEqual([]);
  });

  it("keeps every other key: Ctrl+Space, the arrows, Enter and Esc", () => {
    const keys = completionKeys().map((binding) => binding.key ?? binding.mac);
    expect(keys).toEqual(expect.arrayContaining(["Ctrl-Space", "Alt-`", "Escape", "ArrowDown", "ArrowUp", "Enter"]));
    expect(completionKeys()).toHaveLength(completionKeymap.length - 1);
  });
});
