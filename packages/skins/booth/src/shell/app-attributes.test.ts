// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { UiState } from "./navigation";
import { appAttributes } from "./app-attributes";

const UI: UiState = {
  tab: "tracks",
  panel: null,
  isCodeShown: false,
  overlay: null,
  selectedTrack: null,
  selectedPart: null,
  lengthTarget: "loop",
  libraryTrack: null,
};

describe("appAttributes", () => {
  it("writes the eight attributes in the order the shell always wrote them", () => {
    const attributes = appAttributes({ ui: UI, phase: "running", mode: "loop", isDesktop: true, isCollapsed: false });
    expect(Object.keys(attributes)).toEqual(["phase", "tab", "panel", "code", "overlay", "layout", "collapsed", "mode"]);
  });

  it("a running loop on the desktop with nothing open", () => {
    expect(appAttributes({ ui: UI, phase: "running", mode: "loop", isDesktop: true, isCollapsed: false })).toEqual({
      phase: "running",
      tab: "tracks",
      panel: "none",
      code: "hidden",
      overlay: "none",
      layout: "desktop",
      collapsed: "false",
      mode: "loop",
    });
  });

  it("the waiting screen has no mode, whatever the transport says", () => {
    const attributes = appAttributes({ ui: UI, phase: "idle", mode: "song", isDesktop: false, isCollapsed: false });
    expect(attributes.phase).toBe("idle");
    expect(attributes.mode).toBe("none");
    expect(attributes.layout).toBe("mobile");
  });

  it("song mode, hidden controls, the Code panel, an open panel and an overlay", () => {
    const ui: UiState = { ...UI, tab: "song", panel: "part", isCodeShown: true, overlay: "export" };
    expect(appAttributes({ ui, phase: "running", mode: "song", isDesktop: false, isCollapsed: true })).toEqual({
      phase: "running",
      tab: "song",
      panel: "part",
      code: "shown",
      overlay: "export",
      layout: "mobile",
      collapsed: "true",
      mode: "song",
    });
  });
});
