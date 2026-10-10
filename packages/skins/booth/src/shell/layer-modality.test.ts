// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { layerModality } from "./layer-modality";
import type { Overlay, UiState } from "./navigation";

const closed: UiState = { tab: "tracks", panel: null, isCodeShown: false, overlay: null, selectedTrack: null, selectedPart: null, lengthTarget: "loop", libraryTrack: null };
const phone = { isDesktop: false, isRunning: true };
const desktop = { isDesktop: true, isRunning: true };
const OVERLAYS: readonly Overlay[] = ["library", "share", "export", "length", "tempo", "key", "menu", "projects", "shortcuts", "about"];

describe("layerModality under 1200 px", () => {
  it("makes every overlay modal, trapping Tab in all but the menu", () => {
    for (const overlay of OVERLAYS) {
      expect(layerModality({ ...closed, overlay }, phone)).toEqual({ target: overlay, trapsTab: overlay !== "menu" });
    }
  });
  it("makes the track detail and the part editor modal", () => {
    expect(layerModality({ ...closed, panel: "track", selectedTrack: "kick" }, phone)).toEqual({ target: "track", trapsTab: true });
    expect(layerModality({ ...closed, panel: "part", selectedPart: 0 }, phone)).toEqual({ target: "part", trapsTab: true });
  });
  it("keeps Code non-modal, alone or over the detail", () => {
    expect(layerModality({ ...closed, isCodeShown: true }, phone)).toEqual({ target: null, trapsTab: false });
    expect(layerModality({ ...closed, panel: "track", isCodeShown: true }, phone)).toEqual({ target: null, trapsTab: false });
  });
  it("puts the export over the detail on top", () => {
    expect(layerModality({ ...closed, panel: "track", overlay: "export" }, phone)).toEqual({ target: "export", trapsTab: true });
  });
  it("puts an overlay over Code on top", () => {
    expect(layerModality({ ...closed, isCodeShown: true, overlay: "length" }, phone)).toEqual({ target: "length", trapsTab: true });
  });
  it("has nothing modal when nothing is open", () => {
    expect(layerModality(closed, phone)).toEqual({ target: null, trapsTab: false });
  });
});

describe("layerModality on the desktop", () => {
  it("makes only the tempo, key and length popovers modal", () => {
    for (const overlay of OVERLAYS) {
      const isPopover = overlay === "tempo" || overlay === "key" || overlay === "length";
      expect(layerModality({ ...closed, overlay }, desktop)).toEqual(isPopover ? { target: overlay, trapsTab: true } : { target: null, trapsTab: false });
    }
  });
  it("keeps the side panel non-modal", () => {
    expect(layerModality({ ...closed, panel: "track" }, desktop)).toEqual({ target: null, trapsTab: false });
    expect(layerModality({ ...closed, panel: "part" }, desktop)).toEqual({ target: null, trapsTab: false });
    expect(layerModality({ ...closed, isCodeShown: true }, desktop)).toEqual({ target: null, trapsTab: false });
  });
  it("makes a popover over the side panel modal", () => {
    expect(layerModality({ ...closed, panel: "track", overlay: "length", lengthTarget: "pattern" }, desktop)).toEqual({ target: "length", trapsTab: true });
  });
});

describe("layerModality before the music runs", () => {
  it("only the menu and its sheets show, so only they can be modal", () => {
    const waiting = { isDesktop: false, isRunning: false };
    for (const overlay of OVERLAYS) {
      const isAnyPhase = overlay === "menu" || overlay === "projects" || overlay === "shortcuts" || overlay === "about";
      expect(layerModality({ ...closed, overlay }, waiting).target).toBe(isAnyPhase ? overlay : null);
    }
    expect(layerModality({ ...closed, panel: "track" }, waiting)).toEqual({ target: null, trapsTab: false });
  });
});
