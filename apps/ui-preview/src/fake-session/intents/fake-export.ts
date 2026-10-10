// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's fake (the export-* screens): opening shows the choices,
// Render takes six seconds and ends Ready, with the data of the wireframes. No worker, no
// file. The preview layouts are fixtures of @untzel/export's brandLayout at HD (the
// preview tool does not depend on the export package).
import type { ExportIntents } from "@untzel/skin-contract";
import type { PlaybackMode } from "@untzel/session";
import type { ExportFormat, ExportPreviewLayout, ExportQualityName, ExportRangeView, ExportStatus, ExportView } from "@untzel/presentation/view-model";

const EXPORT_SECONDS = 6;
const DURATIONS: Readonly<Record<ExportFormat, string>> = { story: "0:15 + 2 s", video: "3:24 + 2 s", audio: "3:24 · WAV" };
const PARTS = [
  { index: 0, label: "1 · intro · 8 bars" },
  { index: 1, label: "2 · build · 8 bars" },
  { index: 2, label: "3 · drop · 16 bars" },
  { index: 3, label: "4 · outro · 8 bars" },
];
const RESOLUTIONS: Readonly<Record<ExportFormat, Readonly<Record<ExportQualityName, string>>>> = {
  story: { hd: "1080 × 1920", "4k": "2160 × 3840" },
  video: { hd: "1920 × 1080", "4k": "3840 × 2160" },
  audio: { hd: "1080 × 1920", "4k": "2160 × 3840" },
};
const STORY: ExportPreviewLayout = {
  aspect: 0.5625,
  scrim: { left: 0.26852, top: 0.69271, width: 0.46296, height: 0.09167 },
  scrimRadius: 0.02593,
  markLogo: { left: 0.38611, top: 0.70833, width: 0.2287, height: 0.0375 },
  markUrl: { top: 0.75604, size: 0.02963, center: 0.5 },
  ringsClearance: null,
  cardLogo: { left: 0.2037, top: 0.40625, width: 0.59259, height: 0.09688 },
  cardUrl: { top: 0.52563, size: 0.04074, center: 0.5 },
};
const VIDEO: ExportPreviewLayout = {
  aspect: 1.77778,
  scrim: { left: 0.69479, top: 0.75741, width: 0.26042, height: 0.16296 },
  scrimRadius: 0.01458,
  markLogo: { left: 0.76094, top: 0.78519, width: 0.12865, height: 0.06667 },
  markUrl: { top: 0.87, size: 0.01667, center: 0.825 },
  ringsClearance: { centerX: 0.5, centerY: 0.5, inner: 0.23729, outer: 0.24563 },
  cardLogo: { left: 0.33333, top: 0.46019, width: 0.33333, height: 0.17222 },
  cardUrl: { top: 0.67241, size: 0.02292, center: 0.5 },
};
const LAYOUTS: Readonly<Record<ExportFormat, ExportPreviewLayout>> = { story: STORY, video: VIDEO, audio: STORY };

export interface FakeExportOptions {
  readonly progress: number | null;
  readonly status: ExportStatus | undefined;
  /** Captures: the state stays as the preset drew it. */
  readonly still: boolean;
  readonly isSong: () => boolean;
  readonly announce: (message: string) => void;
  readonly emit: () => void;
}

export class FakeExport implements ExportIntents {
  /** The preview has no play range to follow (the export's stretch is captured on the real app). */
  useSelectedRange(): void {}
  setExportStretch(): void {}
  setExportFine(): void {}
  useExportPlayRange(): void {}
  toggleExportListen(): void {}
  readonly #options: FakeExportOptions;
  #format: ExportFormat = "story";
  #quality: ExportQualityName = "4k";
  #rangeMode: PlaybackMode | null = null;
  #progress: number | null;
  #startedAt: number | null = null;
  #status: ExportStatus;
  #range: ExportRangeView = { from: 0, to: 3 };

  constructor(options: FakeExportOptions) {
    this.#options = options;
    this.#progress = options.progress;
    this.#status = options.status ?? (options.progress === 1 ? "done" : "rendering");
  }

  view(): ExportView {
    const status = this.#status;
    const isSong = this.#options.isSong();
    const rangeMode = this.#rangeMode ?? (isSong ? "song" : "loop");
    return {
      format: this.#format,
      status,
      progress: status === "failed" ? null : this.#progress,
      secondsLeft: status === "rendering" && this.#format === "video" ? 12 : null,
      durations: DURATIONS,
      origin: "from bar 21 · 8 bars",
      rangeMode,
      stretch: null,
      isPlayRangeChosen: false,
      canChooseSong: isSong,
      parts: rangeMode === "song" ? PARTS : [],
      range: rangeMode === "song" ? this.#range : { bars: 16 },
      quality: this.#quality,
      qualities: [
        { quality: "hd", resolution: RESOLUTIONS[this.#format].hd, estimate: "about 4 s to render" },
        { quality: "4k", resolution: RESOLUTIONS[this.#format]["4k"], estimate: "about 14 s to render" },
      ],
      qualityNote: null,
      preview: LAYOUTS[this.#format],
      // The preview page has no stage: the bare stage, as before the still arrives.
      previewStill: null,
      result: status === "done" ? { label: `Ready · ${DURATIONS[this.#format]} · MP4 · ${RESOLUTIONS[this.#format][this.#quality]} · 66.2 MB`, canShare: true, url: "", kind: this.#format === "audio" ? "audio" : "video" } : null,
      message: status === "failed" ? "The export failed. The music keeps playing." : null,
      isVideoUnavailable: false,
      isSoloHeld: false,
    };
  }

  /** Called on every frame of the fake clock. */
  tick(nowSeconds: number): void {
    if (this.#startedAt === null) return;
    this.#progress = Math.min(1, (nowSeconds - this.#startedAt) / EXPORT_SECONDS);
    if (this.#progress < 1) return;
    this.#startedAt = null;
    this.#status = "done";
    this.#options.announce("Export ready. Download is available.");
  }

  selectExportFormat(format: ExportFormat): void {
    this.#format = format;
    this.#choiceChanged();
  }

  selectExportQuality(quality: ExportQualityName): void {
    this.#quality = quality;
    this.#choiceChanged();
  }

  setExportRangeMode(mode: PlaybackMode): void {
    this.#rangeMode = mode;
    this.#choiceChanged();
  }

  setExportRange(range: ExportRangeView): void {
    this.#range = range;
    this.#choiceChanged();
  }

  /** Opening shows the choices; nothing renders. */
  openExport(): void {
    this.#options.emit();
  }

  renderExport(): void {
    if (this.#options.still || this.#progress === 1 || this.#status === "failed") return;
    this.#startedAt = performance.now() / 1000;
    this.#progress = 0;
    this.#status = "rendering";
    this.#options.emit();
  }

  cancelExport(): void {
    this.#startedAt = null;
    this.#progress = null;
    this.#status = "idle";
    this.#options.emit();
  }

  shareExport(): void {
    this.#options.announce("Shared.");
  }

  downloadExport(): void {
    this.#options.announce("Downloaded.");
  }

  closeExport(): void {
    if (this.#options.still) return;
    this.cancelExport();
  }

  /** A new choice is a new request: back to Render, unless the preset is held for a capture. */
  #choiceChanged(): void {
    if (!this.#options.still && this.#status !== "failed") {
      this.#startedAt = null;
      this.#progress = null;
      this.#status = "idle";
    }
    this.#options.emit();
  }
}
