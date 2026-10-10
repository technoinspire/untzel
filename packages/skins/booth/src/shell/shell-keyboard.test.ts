// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { KeyDescriptor } from "@untzel/skin-contract";
import { isMacPlatform, shouldRunShortcut } from "./shell-keyboard";

const KEY: KeyDescriptor = { key: "Enter", mod: true, shift: false, alt: false, inText: false, onControl: false };

describe("shouldRunShortcut", () => {
  it("Mod+Enter in a text field is the field's own", () => {
    expect(shouldRunShortcut({ kind: "apply-now" }, { ...KEY, inText: true }, "running")).toBe(false);
    expect(shouldRunShortcut({ kind: "apply-now" }, KEY, "running")).toBe(true);
  });

  it("every shortcut runs while the music runs", () => {
    for (const action of [{ kind: "stop" }, { kind: "undo" }, { kind: "toggle-controls" }, { kind: "loop-length", delta: 1 }] as const) {
      expect(shouldRunShortcut(action, KEY, "running"), action.kind).toBe(true);
    }
  });

  it("before the music runs, only play and close act", () => {
    for (const phase of ["idle", "loading", "load-failed", "unsupported"] as const) {
      expect(shouldRunShortcut({ kind: "toggle-play" }, KEY, phase), phase).toBe(true);
      expect(shouldRunShortcut({ kind: "close" }, KEY, phase), phase).toBe(true);
      expect(shouldRunShortcut({ kind: "stop" }, KEY, phase), phase).toBe(false);
      expect(shouldRunShortcut({ kind: "add-track" }, KEY, phase), phase).toBe(false);
    }
  });
});

describe("isMacPlatform", () => {
  it("Apple platforms use Cmd", () => {
    for (const platform of ["MacIntel", "iPhone", "iPad"]) expect(isMacPlatform(platform), platform).toBe(true);
  });

  it("the others use Ctrl", () => {
    for (const platform of ["Win32", "Linux x86_64", ""]) expect(isMacPlatform(platform), platform).toBe(false);
  });
});
