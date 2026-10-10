// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { shortcutFor } from "@untzel/skin-contract";
import { shortcutRows } from "./shortcuts-sheet";
describe("shortcutRows", () => {
  it("lists every shortcut once, with the platform's modifier", () => {
    const mac = shortcutRows(true);
    expect(mac.map((row) => row.keys)).toEqual(["Space", "1–9", "A", "D", "[ ]", "H", "⌘Z", "⌘Shift+Z", "⌘Enter", "⌘.", "⌘S", "Esc"]);
    expect(shortcutRows(false).find((row) => row.action === "Undo")?.keys).toBe("Ctrl+Z");
  });
  it("Mod+S is a shortcut: the project saves now", () => {
    const key = { key: "s", mod: true, shift: false, alt: false, inText: false, onControl: false };
    expect(shortcutFor(key)).toEqual({ kind: "save" });
  });
});
