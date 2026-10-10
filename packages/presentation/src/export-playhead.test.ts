// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ExportStretchView, ExportView, TransportView } from "./view-model";
import { describe, expect, it } from "vitest";
import { withExportPlayhead } from "./export-playhead";

const stretch: ExportStretchView = {
  mode: "loop",
  lastBar: 8,
  parts: [],
  startTick: 128,
  endTick: 384,
  timeMap: [{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }],
  capSeconds: 60,
  isFine: false,
  playheadBar: null,
  isListening: false,
  hasPlayRange: true,
  isReset: true,
  playRangeLabel: null,
};
const exported = { stretch } as unknown as ExportView;
const transport = (mode: "loop" | "song", isPlaying: boolean) => ({ mode, isPlaying, loopBar: 4, bar: 17 }) as unknown as TransportView;

describe("the export ruler's playhead", () => {
  it("follows the bar that plays when the stretch's mode sounds", () => {
    expect(withExportPlayhead(exported, transport("loop", true)).stretch?.playheadBar).toBe(4);
  });
  it("stays away in the other mode or stopped", () => {
    expect(withExportPlayhead(exported, transport("song", true)).stretch?.playheadBar).toBeNull();
    expect(withExportPlayhead(exported, transport("loop", false)).stretch?.playheadBar).toBeNull();
  });
});
