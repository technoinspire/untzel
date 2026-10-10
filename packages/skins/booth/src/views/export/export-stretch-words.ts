// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export stretch's words that the adapters also say: times as m:ss.s and
// the format's cap. Apart from the ruler's model so the initial JS carries only these
// (the initial JS budget). Pure.
import { exportLabels, exportStretchPhrases } from "../../copy/copy";
import type { ExportFormat, ExportQualityName } from "@untzel/presentation/view-model";
import { exportAspects, qualityLabels } from "../../copy/strings";

/** "0:07.3": minutes, seconds and tenths. */
export function clockLabel(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  return `${Math.floor(tenths / 600)}:${String(Math.floor((tenths % 600) / 10)).padStart(2, "0")}.${tenths % 10}`;
}

/** "1:00", "4:21": a cap in whole seconds. */
export function limitLabel(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** What the cap is of: the Story, 4K video, the video, or the WAV. */
export function capOf(format: ExportFormat, quality: ExportQualityName): string {
  if (format === "story") return exportLabels.story;
  if (format === "audio") return exportAspects.audio;
  return quality === "4k" ? qualityLabels["4k"] : exportLabels.video;
}

/** "Story up to 1:00", "4K up to 4:21": why a handle stops where it does. */
export function exportCapNote(format: ExportFormat, quality: ExportQualityName, capSeconds: number): string {
  return exportStretchPhrases.cap(capOf(format, quality), limitLabel(capSeconds));
}
