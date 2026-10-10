// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { NO_PROJECT, type TemplateCatalogView } from "./view-model";
import { IDLE_EXPORT, IDLE_SHARE, idleView } from "./waiting-view";
const catalog: TemplateCatalogView = { blank: null, styles: [{ id: "house", label: "House" }], projects: [] };
describe("idleView", () => {
  it("carries the waiting stage's phase, templates and notice", () => {
    const view = idleView({ phase: "loading", catalog, selected: "house/disco-lights", openStyle: "house", notice: { kind: "remix", from: "link" } });
    expect(view.phase).toBe("loading");
    expect(view.templates).toEqual({ catalog, selected: "house/disco-lights", openStyle: "house", notice: { kind: "remix", from: "link" } });
  });
  it("shows a stopped loop of 4 bars in c minor, with no track, no project and idle sheets", () => {
    const view = idleView({ phase: "idle", catalog, selected: "", openStyle: null, notice: null });
    expect(view.transport).toMatchObject({ isPlaying: false, bpm: 132, key: "c minor", mode: "loop", loopBars: 4, bar: null });
    expect(view.tracks).toEqual([]);
    expect(view.playRange).toMatchObject({ mode: "loop", lastBar: 4, range: null });
    expect(view.project).toBe(NO_PROJECT);
    expect(view.share).toBe(IDLE_SHARE);
    expect(view.export).toBe(IDLE_EXPORT);
    expect(IDLE_EXPORT).toMatchObject({ format: "story", status: "idle", quality: "hd", stretch: null });
  });
});
