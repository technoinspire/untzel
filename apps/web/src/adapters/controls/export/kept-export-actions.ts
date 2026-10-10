// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the export sheet does with the file it shows: share it, or download it, and
// say so. Share runs inside the click: navigator.share needs the gesture, so nothing is
// awaited first.
import { downloadBlob, shareFiles } from "@untzel/share";
import { announcements } from "../../../strings/copy";
import type { KeptExport } from "./kept-exports";

/** The system share sheet with the file; a download where the browser cannot share it. */
export function shareKept(shown: KeptExport | null, announce: (message: string) => void): void {
  if (shown === null || !shown.canShare) return;
  void shareFiles([shown.file], "Untzel").then((outcome) => {
    if (outcome !== "unsupported") return;
    downloadBlob(shown.file, shown.file.name);
    announce(announcements.downloadedInstead);
  });
}

export function downloadKept(shown: KeptExport | null, announce: (message: string) => void): void {
  if (shown === null) return;
  downloadBlob(shown.file, shown.file.name);
  announce(announcements.downloaded(shown.file.name));
}
