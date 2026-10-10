// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { PreferenceStore } from "./collapse";
import {
  PANEL_STEP_PX,
  PANEL_WIDTH_STORAGE_KEY,
  defaultPanelWidth,
  panelWidthBounds,
  panelWidthFor,
  readPanelWidth,
  writePanelWidth,
} from "./panel-width";
import { widthForKey } from "../../views/frame/panel-divider";

function memoryStore(): PreferenceStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
}

describe("Code panel width", () => {
  it("defaults to clamp(480px, 40vw, 720px)", () => {
    expect(defaultPanelWidth(1200)).toBe(480);
    expect(defaultPanelWidth(1440)).toBe(576);
    expect(defaultPanelWidth(2560)).toBe(720);
  });

  it("keeps a wanted width between 360 px and 60 % of the window", () => {
    expect(panelWidthBounds(1440)).toEqual({ min: 360, max: 864 });
    expect(panelWidthFor(200, 1440)).toBe(360);
    expect(panelWidthFor(1000, 1440)).toBe(864);
    expect(panelWidthFor(600, 1440)).toBe(600);
    expect(panelWidthFor(null, 1440)).toBe(576);
    // A stored width wider than a smaller window is drawn narrower, not refused.
    expect(panelWidthFor(864, 1200)).toBe(720);
  });

  it("persists like the collapse state, and null goes back to the default", () => {
    const store = memoryStore();
    expect(readPanelWidth(store)).toBeNull();
    writePanelWidth(store, 612);
    expect(store.values.get(PANEL_WIDTH_STORAGE_KEY)).toBe("612");
    expect(readPanelWidth(store)).toBe(612);
    writePanelWidth(store, null);
    expect(readPanelWidth(store)).toBeNull();
    expect(readPanelWidth(null)).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken: PreferenceStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readPanelWidth(broken)).toBeNull();
    expect(() => writePanelWidth(broken, 500)).not.toThrow();
  });

  it("arrows move the divider 16 px, Left widens; Home and End go to the bounds", () => {
    const model = { width: 576, min: 360, max: 864 };
    expect(widthForKey("ArrowLeft", model)).toBe(576 + PANEL_STEP_PX);
    expect(widthForKey("ArrowRight", model)).toBe(576 - PANEL_STEP_PX);
    expect(widthForKey("Home", model)).toBe(360);
    expect(widthForKey("End", model)).toBe(864);
    expect(widthForKey("a", model)).toBeNull();
  });
});
