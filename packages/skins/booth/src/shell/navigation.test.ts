// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { closeTop, isCodeOpen, isLengthOpen, overlayIntents, shownLayers, toggleCode, topLayer, withinMode, type UiState } from "./navigation";
const closed: UiState = { tab: "tracks", panel: null, isCodeShown: false, overlay: null, selectedTrack: null, selectedPart: null, lengthTarget: "loop", libraryTrack: null };
describe("closeTop", () => {
  it("closes the library, whatever the layout", () => {
    expect(closeTop({ ...closed, overlay: "library" })).toEqual({ overlay: null });
  });
  it("closes the overlay first when it covers a panel", () => {
    const ui: UiState = { ...closed, panel: "track", overlay: "export", selectedTrack: "kick" };
    expect(topLayer(ui)).toBe("overlay");
    expect(closeTop(ui)).toEqual({ overlay: null });
  });
  it("closes the panel and keeps the tab", () => {
    expect(closeTop({ ...closed, tab: "song", panel: "track" })).toEqual({ panel: null });
  });
  it("has nothing to close when nothing is open", () => {
    expect(topLayer(closed)).toBeNull();
    expect(closeTop(closed)).toBeNull();
  });
  it("the menu and the sheets it opens close like any overlay", () => {
    for (const overlay of ["menu", "projects", "shortcuts", "about"] as const) {
      expect(closeTop({ ...closed, overlay, isCodeShown: true })).toEqual({ overlay: null });
    }
  });
});
describe("bars and arrangement layers", () => {
  it("closes the length picker first, over the track detail", () => {
    const ui: UiState = { ...closed, panel: "track", overlay: "length", lengthTarget: "pattern" };
    expect(closeTop(ui)).toEqual({ overlay: null });
    expect(isLengthOpen(ui, "pattern")).toBe(true);
    expect(isLengthOpen(ui, "loop")).toBe(false);
  });
  it("keeps the panel content under the picker, which floats over the page", () => {
    const shown = shownLayers({ ...closed, panel: "part", overlay: "length", lengthTarget: "part" });
    expect(shown).toMatchObject({ panel: true, picker: true, part: true, track: false });
    expect(shownLayers({ ...closed, panel: "track", overlay: "library" })).toMatchObject({ panel: true, track: false, library: true });
    expect(shownLayers({ ...closed, overlay: "length" })).toMatchObject({ panel: false, picker: true });
  });
  it("the menu floats like the picker; its sheets fill the panel", () => {
    expect(shownLayers({ ...closed, panel: "track", overlay: "menu" })).toMatchObject({ menu: true, track: true, panel: true });
    expect(shownLayers({ ...closed, overlay: "projects" })).toMatchObject({ panel: true, projects: true });
  });
  it("has no arrangement in loop mode and no loop picker in song mode", () => {
    const part: UiState = { ...closed, panel: "part", overlay: "length", lengthTarget: "part" };
    expect(withinMode(part, "loop")).toMatchObject({ panel: null, overlay: null });
    expect(withinMode(part, "song")).toBe(part);
    expect(withinMode({ ...closed, overlay: "length", lengthTarget: "loop" }, "song").overlay).toBeNull();
    expect(withinMode({ ...closed, panel: "track", overlay: "length", lengthTarget: "pattern" }, "loop").overlay).toBe("length");
  });
});
describe("the code, opened only by Code next to Drop", () => {
  it("opens over Part and closing shows Part again", () => {
    const part: UiState = { ...closed, panel: "part", selectedPart: 1 };
    const open = { ...part, ...toggleCode(part) };
    expect(open).toMatchObject({ isCodeShown: true, panel: "part" });
    expect(shownLayers(open)).toMatchObject({ code: true, part: false, panel: true });
    expect(topLayer(open)).toBe("code");
    const closedAgain = { ...open, ...closeTop(open) };
    expect(closedAgain).toMatchObject({ isCodeShown: false, panel: "part" });
    expect(shownLayers(closedAgain)).toMatchObject({ code: false, part: true });
  });
  it("opened with no panel, closing leaves no panel", () => {
    const open = { ...closed, ...toggleCode(closed) };
    expect(isCodeOpen(open)).toBe(true);
    const back = { ...open, ...toggleCode(open) };
    expect(back).toMatchObject({ isCodeShown: false, panel: null });
    expect(shownLayers(back).panel).toBe(false);
  });
  it("Esc with an overlay over the code closes only the overlay", () => {
    const covered: UiState = { ...closed, isCodeShown: true, overlay: "export" };
    expect(isCodeOpen(covered)).toBe(false);
    expect(closeTop(covered)).toEqual({ overlay: null });
    expect(toggleCode(covered)).toEqual({ isCodeShown: true, overlay: null });
  });
  it("switching mode keeps the code open", () => {
    const open: UiState = { ...closed, isCodeShown: true };
    expect(withinMode(open, "song")).toBe(open);
    expect(withinMode(open, "loop")).toBe(open);
  });
});
describe("overlayIntents", () => {
  it("opening Share prepares the link; opening Export only shows its choices, it renders nothing", () => {
    expect(overlayIntents(null, "share")).toEqual(["prepareShare"]);
    expect(overlayIntents(null, "export")).toEqual(["openExport"]);
  });
  it("leaving closes what was open first, then opens the next", () => {
    expect(overlayIntents("share", "export")).toEqual(["closeShare", "openExport"]);
    expect(overlayIntents("export", null)).toEqual(["closeExport"]);
    // Leaving the library ends what it plays: an audition or a Change sound preview.
    expect(overlayIntents("library", null)).toEqual(["stopPreview", "endTrackPreview"]);
    // Leaving the tempo or key editor closes its undo step.
    expect(overlayIntents("tempo", null)).toEqual(["endGesture"]);
    expect(overlayIntents("key", "length")).toEqual(["endGesture"]);
    expect(overlayIntents("export", "export")).toEqual([]);
    expect(overlayIntents("menu", "share")).toEqual(["prepareShare"]);
  });
});
