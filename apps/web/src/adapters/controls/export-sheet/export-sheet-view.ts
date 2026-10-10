// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's view: built from the sheet's choices, the job's
// state and the kept file, with the parts that come from the tiers and the file's layout
// (the quality options with their resolution and measured time, the note before the
// first probe, the preview's geometry). Pure; the export module is handed in.
import { liveStrings as strings } from "@untzel/skin";
import type * as ExportModule from "@untzel/export";
import type { DeviceProbe, ExportQuality, PlanResult, TierChoice, TierOffer, VideoFormat } from "@untzel/export";
import type { SessionView } from "@untzel/session";
import { effectiveQuality, effectiveRangeMode, type ExportChoiceState } from "./export-choices";
import type { ExportApi, ExportJobs } from "../export/export-jobs";
import { durationLabel, estimateLabel, partLabel, planOrigin, resolutionLabel } from "./export-labels";
import { previewLayoutOf } from "./export-preview-layout";
import { partsWithin } from "../export/export-request";
import type { KeptExport } from "../export/kept-exports";
import type { ExportFormat, ExportPreviewLayout, ExportQualityOption, ExportStretchView, ExportView } from "@untzel/presentation/view-model";

type SheetApi = Pick<typeof ExportModule, "frameSize" | "estimateRenderSeconds" | "brandLayout">;

/** The picture of the audio preview's sibling formats; audio itself has none. */
function pictureFormat(format: ExportFormat): VideoFormat {
  return format === "audio" ? "story" : format;
}

/**
 * HD and 4K at once before the first probe; after it, HD always and 4K where the probe
 * passed. Each in the format's ratio, with the measured time, plus the encoder's start
 * until an encoder has run on this page.
 */
export function qualityOptions(
  api: SheetApi,
  tiers: TierChoice,
  format: ExportFormat,
  planFor: (offer: TierOffer["quality"]) => PlanResult,
  isEncoderStarted: boolean,
): readonly ExportQualityOption[] {
  return tiers.offers.map((offer) => {
    const planned = planFor(offer.quality);
    const seconds = planned.ok ? api.estimateRenderSeconds(planned.plan.totalVideoFrames, offer, isEncoderStarted) : null;
    return { quality: offer.quality, resolution: resolutionLabel(api.frameSize(pictureFormat(format), offer.quality)), estimate: estimateLabel(seconds) };
  });
}

export function qualityNote(tiers: TierChoice | null): string | null {
  return tiers?.isProbed === false ? strings.checksDeviceFirst : null;
}

/** Where the file puts the mark and the card in this format; the same at HD and 4K. */
export function sheetPreview(api: SheetApi, format: ExportFormat): ExportPreviewLayout {
  return previewLayoutOf(api.brandLayout(api.frameSize(pictureFormat(format), "hd")));
}

const FORMATS: readonly ExportFormat[] = ["story", "video", "audio"];

/** Everything the sheet shows, read at one moment. */
export interface ExportSheetState {
  /** Null until the sheet first opens and the module loads. */
  readonly api: ExportApi | null;
  readonly choices: ExportChoiceState;
  readonly jobs: Pick<ExportJobs, "runningPlan" | "progress" | "secondsLeft" | "isEncoderStarted" | "isChecking" | "isRendering" | "isStarting">;
  /** The kept device probe; null before the module loads or before the first probe. */
  readonly probe: DeviceProbe | null;
  /** The kept result for what the sheet asks now. */
  readonly shown: KeptExport | null;
  /** A format's plan at a quality, from the position at this moment. */
  readonly plan: (api: ExportApi, format: ExportFormat, quality: ExportQuality) => PlanResult;
  readonly stretch: ExportStretchView | null;
  readonly isListening: boolean;
  /** Selected range is chosen and there is a stretch to export. */
  readonly isStretchChosen: boolean;
  readonly music: Pick<SessionView, "song" | "solo">;
  readonly hasProgram: boolean;
  readonly message: string | null;
  readonly isVideoUnavailable: boolean;
  readonly previewStill: string | null;
}

/** A video Render on a device with no kept probe checks the device first. */
export function sheetStatus(state: ExportSheetState): ExportView["status"] {
  const { jobs } = state;
  const isAwaitingProbe = jobs.isStarting && state.choices.format !== "audio" && state.probe === null;
  if (jobs.isChecking || isAwaitingProbe) return "checking";
  if (jobs.isRendering) return "rendering";
  if (state.shown !== null) return "done";
  return state.message !== null ? "failed" : "idle";
}

/** The song's parts to pick a stretch from, in Song only, once the module and a program are there. */
export function partOptions(state: ExportSheetState): ExportView["parts"] {
  if (state.api === null || !state.hasProgram || effectiveRangeMode(state.choices) !== "song") return [];
  return (state.music.song?.parts ?? []).map((part, index) => ({ index, label: partLabel(index, part.section, part.bars) }));
}

/** The duration labels at HD: the length of a format does not depend on its quality. */
export function formatDuration(state: ExportSheetState, format: ExportFormat): string {
  const { api } = state;
  const label = durationLabel(api, api === null ? undefined : state.plan(api, format, "hd"));
  return format === "audio" ? `${label} · WAV` : label;
}

export function withListening(stretch: ExportStretchView | null, isListening: boolean): ExportStretchView | null {
  return stretch === null ? null : { ...stretch, isListening };
}

export function exportView(state: ExportSheetState): ExportView {
  const { api, choices, jobs, shown } = state;
  const { format } = choices;
  const tiers = api === null ? null : api.chooseTiers(state.probe);
  const quality = effectiveQuality(choices, tiers);
  const current = api === null ? undefined : state.plan(api, format, quality);
  const frozen = jobs.runningPlan ?? shown?.plan ?? null;
  const parts = partOptions(state);
  const rangeMode = effectiveRangeMode(choices);
  const durations = Object.fromEntries(FORMATS.map((each) => [each, formatDuration(state, each)])) as Record<ExportFormat, string>;
  return {
    format,
    status: sheetStatus(state),
    progress: shown !== null ? 1 : jobs.progress,
    secondsLeft: jobs.secondsLeft,
    durations,
    origin: frozen !== null ? planOrigin(frozen) : current?.ok === true ? planOrigin(current.plan) : "",
    rangeMode,
    stretch: withListening(state.stretch, state.isListening),
    isPlayRangeChosen: state.isStretchChosen,
    canChooseSong: (state.music.song?.parts.length ?? 0) > 0,
    isSoloHeld: state.music.solo !== null,
    parts,
    range: rangeMode === "song" && parts.length > 0 ? partsWithin(choices.songRange, parts.length) : { bars: choices.bars },
    quality,
    qualities: api === null || tiers === null ? [] : qualityOptions(api, tiers, format, (offer) => state.plan(api, format, offer), jobs.isEncoderStarted),
    qualityNote: qualityNote(tiers),
    preview: api === null ? null : sheetPreview(api, format),
    previewStill: state.previewStill,
    result: shown === null ? null : { label: shown.label, canShare: shown.canShare, url: shown.url, kind: shown.format === "audio" ? "audio" : "video" },
    message: state.message,
    isVideoUnavailable: state.isVideoUnavailable,
  };
}
