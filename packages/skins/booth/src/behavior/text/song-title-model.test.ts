// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import {
  clampTitleDraft,
  commitTitleDraft,
  copyTitle,
  remixTitle,
  songTitleLabel,
  titleAnnouncement,
} from "./song-title-model";
describe("songTitleLabel", () => {
  it("shows the title as a rename button, and Untzel with no project", () => {
    expect(songTitleLabel("Midnight Coast")).toEqual({ text: "Midnight Coast", isRenamable: true });
    expect(songTitleLabel(null)).toEqual({ text: "Untzel", isRenamable: false });
  });
});
describe("the title field", () => {
  it("keeps the first 60 code points while typing", () => {
    expect(clampTitleDraft("a".repeat(61))).toBe("a".repeat(60));
    expect(clampTitleDraft("🌊".repeat(61))).toBe("🌊".repeat(60));
    expect(clampTitleDraft("  two  spaces ")).toBe("  two  spaces ");
  });
  it("writes a new title, closes on the same one, keeps the old one when empty", () => {
    expect(commitTitleDraft("  Night   Drive ", "Midnight Coast")).toEqual({ kind: "write", title: "Night Drive" });
    expect(commitTitleDraft("Midnight Coast", "Midnight Coast")).toEqual({ kind: "close" });
    expect(commitTitleDraft(" \t", "Midnight Coast")).toEqual({ kind: "keep" });
  });
  it("says what happened", () => {
    expect(titleAnnouncement({ kind: "write", title: "Night Drive" })).toBe("Renamed to Night Drive.");
    expect(titleAnnouncement({ kind: "keep" })).toBe("The song keeps its name.");
    expect(titleAnnouncement({ kind: "close" })).toBeNull();
  });
});
describe("default titles", () => {
  it("a remix gets the prefix once", () => {
    expect(remixTitle("Midnight Coast")).toBe("Remix of Midnight Coast");
    expect(remixTitle("Remix of Midnight Coast")).toBe("Remix of Midnight Coast");
    expect(remixTitle(null)).toBe("Remix of Untitled");
    // Read in English with the pt-BR catalog never loaded: one prefix, still.
    expect(remixTitle("Remix de Noite")).toBe("Remix de Noite");
  });
  it("a copy gets the suffix", () => {
    expect(copyTitle("Midnight Coast")).toBe("Midnight Coast (copy)");
  });
});
