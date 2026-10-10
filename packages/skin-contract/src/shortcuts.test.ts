// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { shortcutFor, type KeyDescriptor } from "./shortcuts";
const key = (value: string, extra: Partial<KeyDescriptor> = {}): KeyDescriptor => ({
  key: value, mod: false, shift: false, alt: false, inText: false, onControl: false, ...extra,
});

describe("shortcuts", () => {
  it("maps the desktop shortcuts", () => {
    expect(shortcutFor(key(" "))).toEqual({ kind: "toggle-play" });
    expect(shortcutFor(key("3"))).toEqual({ kind: "toggle-track", index: 2 });
    expect(shortcutFor(key("a"))).toEqual({ kind: "add-track" });
    expect(shortcutFor(key("D"))).toEqual({ kind: "drop" });
    expect(shortcutFor(key("z", { mod: true }))).toEqual({ kind: "undo" });
    expect(shortcutFor(key("z", { mod: true, shift: true }))).toEqual({ kind: "redo" });
    expect(shortcutFor(key("Enter", { mod: true }))).toEqual({ kind: "apply-now" });
    expect(shortcutFor(key(".", { mod: true }))).toEqual({ kind: "stop" });
    expect(shortcutFor(key("Escape"))).toEqual({ kind: "close" });
    expect(shortcutFor(key("["))).toEqual({ kind: "loop-length", delta: -1 });
    expect(shortcutFor(key("]"))).toEqual({ kind: "loop-length", delta: 1 });
    expect(shortcutFor(key("]", { inText: true }))).toBeNull();
    // The editor handles these itself; the page must not count them a second time.
    expect(shortcutFor(key("z", { mod: true, inText: true }))).toBeNull();
    expect(shortcutFor(key("z", { mod: true, shift: true, inText: true }))).toBeNull();
    expect(shortcutFor(key("Enter", { mod: true, inText: true }))).toBeNull();
    expect(shortcutFor(key("Escape", { inText: true }))).toEqual({ kind: "close" });
    expect(shortcutFor(key("h"))).toEqual({ kind: "toggle-controls" });
    expect(shortcutFor(key("H"))).toEqual({ kind: "toggle-controls" });
  });

  it("H hides the controls only outside the editor and without modifiers", () => {
    expect(shortcutFor(key("h", { inText: true }))).toBeNull();
    expect(shortcutFor(key("h", { mod: true }))).toBeNull();
    expect(shortcutFor(key("h", { alt: true }))).toBeNull();
    expect(shortcutFor(key("H", { shift: true }))).toBeNull();
    expect(shortcutFor(key("h", { onControl: true }))).toEqual({ kind: "toggle-controls" });
  });

  it("leaves typing alone in the editor and Space on buttons", () => {
    expect(shortcutFor(key(" ", { inText: true }))).toBeNull();
    expect(shortcutFor(key("a", { inText: true }))).toBeNull();
    expect(shortcutFor(key(" ", { onControl: true }))).toBeNull();
    // A control focused by a click does not report onControl (describeKey): Space plays.
    expect(shortcutFor(key(" ", { onControl: false }))).toEqual({ kind: "toggle-play" });
    expect(shortcutFor(key("Escape", { inText: true }))).toEqual({ kind: "close" });
  });
});
