// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Share sheet's intents of the deferred port: forwarded to the running controls once
// the engine runs, dropped before. The port's own saveFile and openFile replace these two,
// since the waiting stage saves and reads files too. Part of the initial JS: types only.
import type { ShareIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardShare(running: () => RunningControls | null): ShareIntents {
  return {
    prepareShare: () => running()?.share.prepareShare(),
    closeShare: () => running()?.share.closeShare(),
    shareLink: () => running()?.share.shareLink(),
    copyLink: () => running()?.share.copyLink(),
    saveFile: () => running()?.share.saveFile(),
    shareFile: () => running()?.share.shareFile(),
    openFile: (file) => running()?.share.openFile(file),
  };
}
