// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The refusals of prepareTitleOverlays. They return before any canvas, which the unit
// environment does not have; the drawn bitmaps are checked in export-render.browser.ts.
import { describe, expect, it } from "vitest";
import { prepareTitleOverlays } from "./title-overlays";
const frame = { width: 1080, height: 1920 };
describe("prepareTitleOverlays", () => {
  it("refuses when a face does not load", async () => {
    const fonts = { load: () => Promise.reject(new Error("offline")), check: () => true };
    expect(await prepareTitleOverlays({ fonts, frame, title: "Night", detail: "132 BPM · c minor" })).toEqual({ ok: false, reason: "font" });
  });
  it("refuses a fallback face", async () => {
    const asked: string[] = [];
    const fonts = {
      load: (font: string) => {
        asked.push(font);
        return Promise.resolve([]);
      },
      check: (font: string) => !font.includes("Jost"),
    };
    expect(await prepareTitleOverlays({ fonts, frame, title: "Night", detail: "132 BPM · c minor" })).toEqual({ ok: false, reason: "font" });
    expect(asked).toEqual(["500 96px Jost", "500 72px Jost", "600 40px 'Hanken Grotesk'"]);
  });
});
