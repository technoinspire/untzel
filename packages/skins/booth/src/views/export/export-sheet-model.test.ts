// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ExportView } from "@untzel/presentation/view-model";
import { exportSheetModel, nextExportFocus } from "./export-sheet-model";
import { waveLevel } from "./export-preview";

const base: ExportView = {
  format: "story",
  status: "idle",
  progress: null,
  secondsLeft: null,
  durations: { story: "0:15 + 2 s", video: "0:29 + 2 s", audio: "0:29 · WAV" },
  origin: "from bar 1 · 8 bars",
  rangeMode: "loop",
  stretch: null,
  isPlayRangeChosen: false,
  canChooseSong: false,
  parts: [],
  range: { bars: 16 },
  quality: "hd",
  qualities: [{ quality: "hd", resolution: "1080 × 1920", estimate: null }],
  qualityNote: "Render checks this device first.",
  preview: null,
  previewStill: null,
  result: null,
  message: null,
  isVideoUnavailable: false,
  isSoloHeld: false,
};
const ready = { label: "Ready · 0:15 + 2 s · MP4 · 1080 × 1920 · 23.0 MB", canShare: true, url: "blob:x", kind: "video" as const };

/** The visible actions, in the sheet's order. */
function actions(view: ExportView): string[] {
  const model = exportSheetModel(view);
  const shown: [string, boolean][] = [
    ["Render", model.isRenderShown],
    ["Share", model.isShareShown],
    ["Download", model.isDownloadShown],
    ["Cancel", model.isCancelShown],
    ["Try again", model.isRetryShown],
  ];
  return shown.filter(([, isShown]) => isShown).map(([name]) => name);
}

describe("exportSheetModel", () => {
  it("idle, as the sheet opens, says nothing renders and offers Render only", () => {
    const model = exportSheetModel(base);
    expect(model.statusText).toBe("0:15 + 2 s · not rendered");
    expect([model.isMeterShown, model.isHintShown, model.isResultShown]).toEqual([false, false, false]);
    expect(actions(base)).toEqual(["Render"]);
  });

  it("checking the device says so and offers Cancel, with no meter yet", () => {
    const view: ExportView = { ...base, status: "checking" };
    const model = exportSheetModel(view);
    expect(model.statusText).toBe("Checking this device…");
    expect([model.isMeterShown, model.isHintShown]).toEqual([false, true]);
    expect(actions(view)).toEqual(["Cancel"]);
  });

  it("rendering shows the meter, the hint, the time left and Cancel; there is no Download yet", () => {
    const view: ExportView = { ...base, status: "rendering", progress: 0.42, secondsLeft: 12 };
    const model = exportSheetModel(view);
    expect(model.statusText).toBe("Rendering 0:15 + 2 s · 42%");
    expect([model.isMeterShown, model.isHintShown, model.isTimeLeftShown]).toEqual([true, true, true]);
    expect(actions(view)).toEqual(["Cancel"]);
  });

  it("done shows the file's label, the file as preview, and Download; Share only where files share", () => {
    const view: ExportView = { ...base, status: "done", progress: 1, result: ready };
    const model = exportSheetModel(view);
    expect(model.statusText).toBe(ready.label);
    expect([model.isResultShown, model.isHintShown, model.isMeterShown]).toEqual([true, false, false]);
    expect(actions(view)).toEqual(["Share", "Download"]);
    expect(actions({ ...view, result: { ...ready, canShare: false } })).toEqual(["Download"]);
  });

  it("failed shows the message and Try again, without the hint; no Try again without video", () => {
    const view: ExportView = { ...base, status: "failed", message: "The export failed. The music keeps playing." };
    const model = exportSheetModel(view);
    expect([model.isStatusShown, model.isMeterShown, model.isHintShown, model.isFailureShown]).toEqual([false, false, false, true]);
    expect(actions(view)).toEqual(["Try again"]);
    expect(actions({ ...view, isVideoUnavailable: true })).toEqual([]);
  });

  it("the story has no range; the others offer Loop or Song when there is a song, and parts in a song range", () => {
    expect(exportSheetModel(base).isRangeShown).toBe(false);
    const loop: ExportView = { ...base, format: "video" };
    expect([exportSheetModel(loop).isRangeShown, exportSheetModel(loop).isRangeModeShown, exportSheetModel(loop).isSongRange]).toEqual([true, false, false]);
    const song: ExportView = { ...base, format: "video", canChooseSong: true, rangeMode: "song", parts: [{ index: 0, label: "1 · intro · 8 bars" }], range: { from: 0, to: 0 } };
    expect([exportSheetModel(song).isRangeModeShown, exportSheetModel(song).isSongRange]).toEqual([true, true]);
  });
  it("offers Selected range once the stretch is there, and shows its ruler while chosen, the Story included", () => {
    const stretch = { mode: "loop", lastBar: 8, parts: [], startTick: 0, endTick: 512, timeMap: [{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }], capSeconds: 60, isFine: false, playheadBar: null, isListening: false, hasPlayRange: false, isReset: true, playRangeLabel: null } as const;
    const story = exportSheetModel({ ...base, stretch, isPlayRangeChosen: true });
    expect([story.isRangeShown, story.isRangeModeShown, story.isStretchShown]).toEqual([true, true, true]);
    expect(exportSheetModel({ ...base, stretch, isPlayRangeChosen: false }).isStretchShown).toBe(false);
    const video = exportSheetModel({ ...base, format: "video", stretch, isPlayRangeChosen: false });
    expect([video.isRangeModeShown, video.isSelectedRangeShown, video.isStretchShown, video.isRangePickerShown]).toEqual([true, true, false, true]);
  });

  it("offers the quality for every picture format, not for audio", () => {
    expect(exportSheetModel({ ...base, format: "video" }).isQualityShown).toBe(true);
    expect(exportSheetModel({ ...base, format: "audio" }).isQualityShown).toBe(false);
  });

  it("the decorative waveform stays between 0.2 and 1", () => {
    const levels = Array.from({ length: 48 }, (_, index) => waveLevel(index));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
  });
  it("tells a held solo stays on the page: the file plays every track", () => {
    expect(exportSheetModel(base).isSoloNoticeShown).toBe(false);
    expect(exportSheetModel({ ...base, isSoloHeld: true }).isSoloNoticeShown).toBe(true);
  });
});

describe("nextExportFocus", () => {
  const next = (view: ExportView) => nextExportFocus(exportSheetModel(view));
  it("Render hands the focus to Cancel while the device is checked and the file renders", () => {
    expect(next({ ...base, status: "checking" })).toBe("cancel");
    expect(next({ ...base, status: "rendering", progress: 0.4 })).toBe("cancel");
  });
  it("Cancel hands it back to Render", () => {
    expect(next(base)).toBe("render");
  });
  it("the finished file hands it to Download", () => {
    expect(next({ ...base, status: "done", result: ready })).toBe("download");
  });
  it("a failure hands it to Try again, or to nothing when no video codec exists", () => {
    expect(next({ ...base, status: "failed", message: "The export failed. The music keeps playing." })).toBe("retry");
    expect(next({ ...base, status: "failed", message: "No video here.", isVideoUnavailable: true })).toBeNull();
  });
});
