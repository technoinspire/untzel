// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's read-only view model. The composition builds it
// from the export plan, the device probe and the kept files; the sheet only shows it.
import type { PlaybackMode } from "@untzel/session";
import type { TimeMap } from "@untzel/session/rules";
import type { ExportFormat, ExportQualityName } from "./export-format";
export type { ExportFormat, ExportQualityName } from "./export-format";
/** "checking": the device probe runs before the first render of this device. */
export type ExportStatus = "idle" | "checking" | "rendering" | "done" | "failed";

export interface ExportPartOption {
  readonly index: number;
  /** "1 · intro · 8 bars". */
  readonly label: string;
}

export type ExportRangeView = { readonly from: number; readonly to: number } | { readonly bars: number };

export interface ExportQualityOption {
  readonly quality: ExportQualityName;
  /** "1080 × 1920" in the selected format's ratio. */
  readonly resolution: string;
  /** "about 6 s to render"; null before the device was probed. */
  readonly estimate: string | null;
}

/** A rectangle as fractions of the frame's width (left, width) and height (top, height). */
export interface FractionRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A line centred on an axis: the top of its box (fraction of the height), its size and its axis (fractions of the width). */
export interface FractionLine {
  readonly top: number;
  readonly size: number;
  readonly center: number;
}

/** The rings' disc the 16:9 glow is cut out of: centre as fractions of the width and the height, radii of the width. */
export interface FractionClearance {
  readonly centerX: number;
  readonly centerY: number;
  readonly inner: number;
  readonly outer: number;
}

/** Where the file puts the mark and the card, so the preview shows the file's composition. */
export interface ExportPreviewLayout {
  /** Frame width over height. */
  readonly aspect: number;
  readonly scrim: FractionRect;
  /** Fraction of the frame width. */
  readonly scrimRadius: number;
  readonly markLogo: FractionRect;
  readonly markUrl: FractionLine;
  /** The 16:9 corner only; null keeps the whole glow (the story). */
  readonly ringsClearance: FractionClearance | null;
  readonly cardLogo: FractionRect;
  readonly cardUrl: FractionLine;
}

export interface ExportResultView {
  /** "Ready · 0:15 + 2 s · MP4 · 1080 × 1920 · 23.0 MB". */
  readonly label: string;
  readonly canShare: boolean;
  /** The finished file, for the preview player (an object URL the composition owns). */
  readonly url: string;
  readonly kind: "video" | "audio";
}

/**
 * The export's stretch: a copy of the play range (or the
 * whole loop or song) the sheet edits on the same ruler, by steps. Ticks are 1/64 of a bar
 * from the ruler's left edge, half-open.
 */
export interface ExportStretchView {
  readonly mode: PlaybackMode;
  readonly lastBar: number;
  /** Song mode: the parts along the ruler, 1-based and inclusive (model.ts RulerPartView). */
  readonly parts: readonly { readonly name: string; readonly startBar: number; readonly endBar: number }[];
  readonly startTick: number;
  readonly endTick: number;
  /** Seconds along the ruler, for the readouts and the cap. */
  readonly timeMap: TimeMap;
  /** The longest stretch the chosen format and quality take, the 2 s card not counted. */
  readonly capSeconds: number;
  readonly isFine: boolean;
  /** 1-based bar of the ruler playing now, when its mode sounds; null otherwise. */
  readonly playheadBar: number | null;
  /** Listen plays the stretch now. */
  readonly isListening: boolean;
  /** The reset copies the play range ("Use play range"); without one, the whole loop or song. */
  readonly hasPlayRange: boolean;
  /** The stretch is that copy already: the reset is inert. */
  readonly isReset: boolean;
  /**
   * "Bars 9–28 · build → drop" (the export follows the range) while the
   * stretch is the play range itself, uncut; null once the sheet's handles or a cap move it.
   */
  readonly playRangeLabel: string | null;
}
export interface ExportView {
  readonly format: ExportFormat;
  readonly status: ExportStatus;
  /** 0..1 while rendering; 1 when done; null before starting. */
  readonly progress: number | null;
  /** Shown only when the estimate is above 10 s. */
  readonly secondsLeft: number | null;
  /** From the export plan, for example { story: "0:15 + 2 s", video: "1:41 + 2 s", audio: "1:41 · WAV" }; the 2 s are the closing card. */
  readonly durations: Readonly<Record<ExportFormat, string>>;
  /** For example "from bar 21 · 8 bars". */
  readonly origin: string;
  /** Loop or Song for every format but the story; Song only when the text has a song. */
  readonly rangeMode: PlaybackMode;
  /** Selected range: the stretch on its ruler; null until the export module and a program are there. */
  readonly stretch: ExportStretchView | null;
  /** Selected range is the stretch: the export starts and ends where its handles are. Always, in the Story. */
  readonly isPlayRangeChosen: boolean;
  readonly canChooseSong: boolean;
  /** Song range: the parts for From and To. Empty in a loop range, which offers Bars. */
  readonly parts: readonly ExportPartOption[];
  readonly range: ExportRangeView;
  readonly quality: ExportQualityName;
  /** HD always; 4K only where the device probe passed. */
  readonly qualities: readonly ExportQualityOption[];
  /** "Render checks this device first. If it cannot take 4K, it renders HD." before the first probe. */
  readonly qualityNote: string | null;
  /** Null until the export module has loaded (an instant after the sheet opens). */
  readonly preview: ExportPreviewLayout | null;
  /** A still of the scene as the file draws it (an object URL the composition owns); null shows the bare stage. */
  readonly previewStill: string | null;
  readonly result: ExportResultView | null;
  /** An error or a limit, in words. */
  readonly message: string | null;
  /** No video codec in this browser: Story and Video are inert, Audio works. */
  readonly isVideoUnavailable: boolean;
  /** A solo is held on the page: the file plays the text, every track. */
  readonly isSoloHeld: boolean;
}
