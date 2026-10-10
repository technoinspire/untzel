// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The page side of the export, loaded on demand when the export sheet opens. The worker
// entry is ./worker; the WAV writer alone is ./wav (the simulator uses it).
export {
  ATTRIBUTION_COMMENT,
  CARD_FADE_FRAMES,
  CARD_FONT,
  CARD_URL,
  LOGO_RECT,
  URL_RECT,
  drawClosingCard,
  measureTextBox,
  measureUrlBox,
  type CardRect,
} from "./brand/card";
export {
  MARK_LOGO_RECT,
  MARK_SCRIM_RECT,
  MARK_URL_BASELINE,
  MARK_URL_FONT,
  MARK_URL_RECT,
  contrastRatio,
  drawBrandMark,
  relativeLuminance,
  worstCaseMarkContrast,
} from "./brand/brand-mark";
export { REFERENCE_SIZE, brandFont, brandLayout, markPlacement, type BrandLayout, type MarkPlacement, type RingsClearance, type TextLine } from "./brand/brand-layout";
export { prepareVideoBranding, type BrandingResult, type VideoBranding } from "./brand/branding";
export { prepareTitleOverlays, type FrameTitle, type TitleOverlaysOptions, type TitleOverlaysResult } from "./title/title-overlays";
export { titleCardHeight, titleCardRect, topBand } from "./title/title-card";
export { CAPTION_MAX_WIDTH, captionRect } from "./title/title-caption";
export { PROBE_CACHE_KEY, deviceKey, parseProbe, serializeProbe, type DeviceTraits } from "./probe/probe-cache";
export {
  AAC_BITRATE,
  MAX_VIDEO_BYTES,
  QUALITIES,
  VIDEO_BITRATES,
  chooseTiers,
  isCompleteProbe,
  ENCODER_START_SECONDS,
  estimateRenderSeconds,
  frameSize,
  maxSecondsFor,
  type DeviceProbe,
  type ExportQuality,
  type FrameSize,
  type TierChoice,
  type TierOffer,
  type TierProbe,
  type VideoFormat,
} from "./probe/tiers";
export { ExportClient, type ExportResult, type ExportStartInput, type WorkerFactory } from "./messaging/client";
export type { ExportFailure, ExportSource, ExportWorkerToMain, MainToExportWorker, ProbedCodecs } from "./messaging/protocol";
export type { RateControlReport } from "./video/bitrate-governor";
export type { ExportTransport, ExportTransportFactory, ExportWorkerOptions } from "./ports";
export {
  CARD_SECONDS,
  CARD_VIDEO_FRAMES,
  TITLE_CARD_EXIT_VIDEO_FRAMES,
  TITLE_CARD_SECONDS,
  TITLE_CARD_VIDEO_FRAMES,
  DEFAULT_EXPORT_BARS,
  EXPORT_BAR_CHOICES,
  CUT_FADE_FRAMES,
  MAX_EXPORT_SECONDS,
  STORY_STRETCH_MAX_SECONDS,
  exportCapSeconds,
  formatDuration,
  planDurationLabel,
  planExport,
  planSeconds,
  type ExportFormat,
  type ExportPlan,
  type ExportRange,
  type ExportRequest,
  type PlanFailure,
  type PlanResult,
  type PlannedSource,
} from "./plan";
export type { DspCounters } from "./audio/render-audio";
export type { ExportTimeline, TimelineContext, TimelineStart } from "./timeline";
// In the index, not a page chunk of its own: a second entry splits plan.ts out of the
// client and costs more than the function.
export { planTake } from "./take-plan";
