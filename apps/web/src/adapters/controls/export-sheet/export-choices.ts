// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the export sheet's choices mean at one moment: the
// quality and the stretch's mode in effect, the cap, and the key a render is kept under.
// Pure, over one plain record of the choices and of the music they read.
import { exportCapNote } from "@untzel/skin";
import type { DeviceProbe, ExportQuality, ExportRange, ExportRequest, TierChoice } from "@untzel/export";
import type { ExportStretch, PlaybackMode, SessionView } from "@untzel/session";
import type { ExportFormat } from "@untzel/presentation/view-model";
import type { ExportApi } from "../export/export-jobs";
import { exportRangeOf, partsWithin, requestKey, type PartRange } from "../export/export-request";

/** The sheet's choices and the music they read, at one moment. */
export interface ExportChoiceState {
  readonly format: ExportFormat;
  /** Null: the highest tier this device renders at real time. */
  readonly quality: ExportQuality | null;
  /** Null: the mode that plays. */
  readonly rangeMode: PlaybackMode | null;
  /** Selected range: the stretch is the file's. */
  readonly isPlayRangeChosen: boolean;
  /** The ruler the sheet's stretch counts on; null without a stretch. Read only when asked: reading the stretch syncs it with the music. */
  readonly stretchMode: () => PlaybackMode | null;
  /** Song: the parts from and to; null is the whole song. */
  readonly songRange: PartRange | null;
  /** Loop: the bars asked for. */
  readonly bars: number;
  readonly playing: Pick<SessionView, "mode" | "song" | "playing" | "position">;
}

/** The chosen quality where the device offers it, else the device's default (HD before the module loads). */
export function effectiveQuality(state: Pick<ExportChoiceState, "quality">, tiers: TierChoice | null): ExportQuality {
  if (tiers === null) return state.quality ?? "hd";
  const offered = tiers.offers.some((offer) => offer.quality === state.quality);
  return state.quality !== null && offered ? state.quality : tiers.defaultQuality;
}

/** Loop or Song as chosen, else as it plays; Song without parts is Loop. */
export function effectiveRangeMode(state: ExportChoiceState): PlaybackMode {
  const mode = state.rangeMode ?? state.playing.mode ?? "loop";
  return mode === "song" && (state.playing.song?.parts.length ?? 0) === 0 ? "loop" : mode;
}

/** Selected range counts on the stretch's ruler; the story otherwise follows what plays. */
export function modeForFormat(state: ExportChoiceState, format: ExportFormat): PlaybackMode {
  const stretchMode = state.stretchMode();
  if (stretchMode !== null && state.isPlayRangeChosen) return stretchMode;
  return format === "story" ? (state.playing.mode ?? "loop") : effectiveRangeMode(state);
}

/** The quality chosen now (the device's best before a choice); null before the export module loads. */
export function chosenQuality(state: Pick<ExportChoiceState, "quality">, tiers: TierChoice | null): ExportQuality | null {
  return tiers === null ? null : effectiveQuality(state, tiers);
}

/** The stretch's cap at the quality chosen now, with its note; null before the export module loads. */
export function stretchCap(state: Pick<ExportChoiceState, "format" | "quality">, api: Pick<ExportApi, "chooseTiers" | "exportCapSeconds"> | null, probe: DeviceProbe | null): { readonly seconds: number; readonly note: string } | null {
  const quality = chosenQuality(state, api === null ? null : api.chooseTiers(probe));
  const seconds = quality === null ? null : capSeconds(api, state.format, quality);
  return seconds === null || quality === null ? null : { seconds, note: exportCapNote(state.format, quality, seconds) };
}

/** The music a format exports; the stretch (cut to the format's cap) only when Selected range is chosen. */
export function exportRange(state: ExportChoiceState, format: ExportFormat, stretch: () => ExportStretch | null): ExportRange | null {
  const parts = partsWithin(state.songRange, state.playing.song?.parts.length ?? 0);
  return exportRangeOf({ format, mode: effectiveRangeMode(state), bars: state.bars, parts, stretch: state.isPlayRangeChosen ? stretch() : null });
}

/** What the plan of a format at a quality covers, from the position at this moment. */
export function planRequest(state: ExportChoiceState, format: ExportFormat, quality: ExportQuality, stretch: () => ExportStretch | null): ExportRequest {
  const { playing } = state;
  const mode = modeForFormat(state, format);
  return { format, quality, range: exportRange(state, format, stretch), mode, position: playing.playing ? playing.position : null };
}

/** The longest stretch a format takes at a quality; null before the export module loads. */
export function capSeconds(api: Pick<ExportApi, "exportCapSeconds"> | null, format: ExportFormat, quality: ExportQuality): number | null {
  return api?.exportCapSeconds(format, quality) ?? null;
}

export interface RenderKeyRequest {
  readonly sourceHash: number;
  readonly quality: ExportQuality;
  /** The stretch of the sheet's format at that quality, when Selected range is chosen. */
  readonly stretch: () => ExportStretch | null;
  /** The song's title as the file writes it. */
  readonly title: string;
}

/** The title is in the key: renaming keeps the hash; "Untitled" follows the language. */
export function renderKey(state: ExportChoiceState, request: RenderKeyRequest): string {
  const { format } = state;
  const { sourceHash, quality } = request;
  const range = exportRange(state, format, request.stretch);
  return `${requestKey({ sourceHash, format, quality, mode: modeForFormat(state, format), range })}|${request.title}`;
}
