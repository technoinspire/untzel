// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export and share sheets' intents of the fake session, forwarded to their own fakes
// (fake-export.ts, fake-share.ts).

import type { ExportIntents, ShareIntents } from "@untzel/skin-contract";
import type { FakeExport } from "./fake-export";
import type { FakeShare } from "./fake-share";

export function fakeSheetIntents(exporter: FakeExport, share: FakeShare): ExportIntents & ShareIntents {
  return {
    selectExportFormat: (format) => exporter.selectExportFormat(format),
    selectExportQuality: (quality) => exporter.selectExportQuality(quality),
    setExportRangeMode: (mode) => exporter.setExportRangeMode(mode),
    useSelectedRange: () => exporter.useSelectedRange(),
    setExportStretch: () => exporter.setExportStretch(),
    setExportFine: () => exporter.setExportFine(),
    useExportPlayRange: () => exporter.useExportPlayRange(),
    toggleExportListen: () => exporter.toggleExportListen(),
    openExport: () => exporter.openExport(),
    renderExport: () => exporter.renderExport(),
    cancelExport: () => exporter.cancelExport(),
    setExportRange: (range) => exporter.setExportRange(range),
    shareExport: () => exporter.shareExport(),
    downloadExport: () => exporter.downloadExport(),
    closeExport: () => exporter.closeExport(),
    prepareShare: () => share.prepareShare(),
    closeShare: () => share.closeShare(),
    shareLink: () => share.shareLink(),
    copyLink: () => share.copyLink(),
    saveFile: () => share.saveFile(),
    shareFile: () => share.shareFile(),
    openFile: (file) => share.openFile(file),
  };
}
