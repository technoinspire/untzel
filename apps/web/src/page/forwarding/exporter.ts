// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's intents of the deferred port: forwarded to the
// running controls once the engine runs, dropped before. Part of the initial JS: types only.
import type { ExportIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardExporter(running: () => RunningControls | null): ExportIntents {
  return {
    selectExportFormat: (format) => running()?.exporter.selectExportFormat(format),
    selectExportQuality: (quality) => running()?.exporter.selectExportQuality(quality),
    setExportRangeMode: (mode) => running()?.exporter.setExportRangeMode(mode),
    useSelectedRange: () => running()?.exporter.useSelectedRange(),
    setExportStretch: (startTick, endTick, gesture) => running()?.exporter.setExportStretch(startTick, endTick, gesture),
    setExportFine: (isFine) => running()?.exporter.setExportFine(isFine),
    useExportPlayRange: () => running()?.exporter.useExportPlayRange(),
    toggleExportListen: () => running()?.exporter.toggleExportListen(),
    openExport: () => running()?.exporter.openExport(),
    renderExport: () => running()?.exporter.renderExport(),
    cancelExport: () => running()?.exporter.cancelExport(),
    setExportRange: (range) => running()?.exporter.setExportRange(range),
    shareExport: () => running()?.exporter.shareExport(),
    downloadExport: () => running()?.exporter.downloadExport(),
    closeExport: () => running()?.exporter.closeExport(),
  };
}
