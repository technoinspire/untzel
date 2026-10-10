// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the export sheet shows for each status, decided without the DOM. Each status has
// one way forward: idle offers Render, checking and rendering offer Cancel, done offers
// Download (and Share where the system takes the file) with the file itself as preview,
// failed offers Try again. Nothing claims to render when no job runs, and there is no
// Download before a file exists.
import type { ExportView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

export interface ExportSheetModel {
  readonly statusText: string;
  /** 0..1 for the meter. */
  readonly progress: number;
  readonly percent: number;
  readonly isStatusShown: boolean;
  readonly isMeterShown: boolean;
  /** "The music keeps playing while it renders." */
  readonly isHintShown: boolean;
  readonly isTimeLeftShown: boolean;
  readonly isFailureShown: boolean;
  readonly isRetryShown: boolean;
  readonly isCancelShown: boolean;
  readonly isRenderShown: boolean;
  readonly isShareShown: boolean;
  readonly isDownloadShown: boolean;
  /** The finished file plays in the preview; before it, the drawn composition. */
  readonly isResultShown: boolean;
  /** Selected range, Loop or Song; the story has only its stretch. */
  readonly isRangeShown: boolean;
  readonly isRangeModeShown: boolean;
  readonly isSongRange: boolean;
  /** Selected range is offered once the stretch is there; From, To and Bars hide while it is chosen. */
  readonly isSelectedRangeShown: boolean;
  /** The stretch's ruler, readouts, Fine and the cap. */
  readonly isStretchShown: boolean;
  readonly isRangePickerShown: boolean;
  /** HD and 4K; audio has no picture. */
  readonly isQualityShown: boolean;
  /** "Solo stays on this page: the file plays every track." */
  readonly isSoloNoticeShown: boolean;
}

export function exportSheetModel(state: ExportView): ExportSheetModel {
  const { status } = state;
  const progress = state.progress ?? 0;
  const isDone = status === "done" && state.result !== null;
  const isWorking = status === "checking" || status === "rendering";
  const hasRange = state.format !== "story" || state.stretch !== null;
  return {
    statusText: statusText(state, progress),
    progress,
    percent: Math.round(progress * 100),
    isStatusShown: status !== "failed",
    isMeterShown: status === "rendering",
    isHintShown: isWorking,
    isTimeLeftShown: status === "rendering" && state.secondsLeft !== null,
    isFailureShown: state.message !== null,
    isRetryShown: status === "failed" && !state.isVideoUnavailable,
    isCancelShown: isWorking,
    isRenderShown: status === "idle",
    isShareShown: isDone && state.result?.canShare === true,
    isDownloadShown: isDone,
    isResultShown: isDone,
    isRangeShown: hasRange,
    // The Story: Now playing or Selected range; the others: Selected range, Loop, Song.
    isRangeModeShown: state.stretch !== null || (state.format !== "story" && state.canChooseSong),
    isSongRange: state.rangeMode === "song" && state.parts.length > 0,
    isSelectedRangeShown: state.stretch !== null,
    isStretchShown: state.stretch !== null && state.isPlayRangeChosen,
    isRangePickerShown: state.format !== "story" && !state.isPlayRangeChosen,
    isQualityShown: state.format !== "audio",
    isSoloNoticeShown: state.isSoloHeld,
  };
}

export type ExportAction = "cancel" | "download" | "retry" | "render";

/**
 * The action that takes the focus when the focused one hides with a new status:
 * Render → Cancel, Cancel → Render, the end of the render → Download, a failure →
 * Try again. Null when no action shows.
 */
export function nextExportFocus(model: Pick<ExportSheetModel, "isCancelShown" | "isDownloadShown" | "isRetryShown" | "isRenderShown">): ExportAction | null {
  if (model.isCancelShown) return "cancel";
  if (model.isDownloadShown) return "download";
  if (model.isRetryShown) return "retry";
  return model.isRenderShown ? "render" : null;
}

function statusText(state: ExportView, progress: number): string {
  switch (state.status) {
    case "done":
      return state.result?.label ?? "";
    case "failed":
      return "";
    case "idle":
      return strings.notRendered(state.durations[state.format]);
    case "checking":
      return strings.checkingDevice;
    case "rendering":
      return strings.rendering(state.durations[state.format], Math.round(progress * 100));
  }
}
