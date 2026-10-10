// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { UiState } from "@untzel/skin-booth";
import type { PlaybackMode } from "@untzel/session";
import type { AppPhase, ExportStatus, ReceivedNotice } from "@untzel/presentation/view-model";

// ?screen= presets: the main screens, the two desktop panels and the load-error
// and unsupported-browser states, and the controls hidden.

export interface ScreenPreset {
  readonly phase: AppPhase;
  readonly mode: PlaybackMode;
  readonly ui: Partial<UiState>;
  readonly exportProgress: number | null;
  readonly withError: boolean;
  readonly withChange: boolean;
  /** The editing area hidden, the stage filling the screen. */
  readonly collapsed: boolean;
  /** Export sheet: rendering by default; done or failed for the export-done and export-failed screens. */
  readonly exportStatus?: ExportStatus;
  /** Share sheet (share, share-too-long): a link, or a song too long for one. */
  readonly shareLink?: "ready" | "too-long";
  /** Waiting stage with a received link. */
  readonly notice?: ReceivedNotice;
}

const running = (mode: PlaybackMode, ui: Partial<UiState>, extra: Partial<ScreenPreset> = {}): ScreenPreset => ({
  phase: "running",
  mode,
  ui,
  exportProgress: null,
  withError: false,
  withChange: false,
  collapsed: false,
  ...extra,
});

export const SCREENS = {
  A: { phase: "idle", mode: "loop", ui: {}, exportProgress: null, withError: false, withChange: false, collapsed: false },
  B: running("loop", { tab: "tracks" }),
  C: running("loop", { tab: "tracks", overlay: "library" }),
  D: running("loop", { tab: "tracks", panel: "track" }),
  E: running("song", { tab: "song" }),
  F: running("loop", { tab: "tracks", isCodeShown: true }, { withError: true, withChange: true }),
  G: running("loop", { tab: "tracks", overlay: "export" }, { exportProgress: 0.62 }),
  "desktop-track": running("song", { tab: "tracks", panel: "track" }),
  "desktop-code": running("song", { tab: "tracks", isCodeShown: true }, { withChange: true }),
  collapsed: running("loop", { tab: "tracks" }, { collapsed: true }),
  "collapsed-code": running("loop", { tab: "tracks", isCodeShown: true }, { collapsed: true, withChange: true }),
  "desktop-collapsed": running("song", { tab: "tracks" }, { collapsed: true }),
  share: running("loop", { tab: "tracks", overlay: "share" }, { shareLink: "ready" }),
  "share-too-long": running("loop", { tab: "tracks", overlay: "share" }, { shareLink: "too-long" }),
  remix: { phase: "idle", mode: "loop", ui: {}, exportProgress: null, withError: false, withChange: false, collapsed: false, notice: { kind: "remix", from: "link" } },
  "link-failed": {
    phase: "idle",
    mode: "loop",
    ui: {},
    exportProgress: null,
    withError: false,
    withChange: false,
    collapsed: false,
    notice: { kind: "failed", message: "This link could not be opened." },
  },
  "export-rendering": running("loop", { tab: "tracks", overlay: "export" }, { exportProgress: 0.42, exportStatus: "rendering" }),
  "export-done": running("loop", { tab: "tracks", overlay: "export" }, { exportProgress: 1, exportStatus: "done" }),
  "export-idle": running("loop", { tab: "tracks", overlay: "export" }, { exportProgress: null, exportStatus: "idle" }),
  "export-failed": running("loop", { tab: "tracks", overlay: "export" }, { exportProgress: null, exportStatus: "failed" }),
  // Bars and arrangement: the length picker, a part open.
  length: running("loop", { tab: "tracks", overlay: "length", lengthTarget: "loop" }),
  part: running("song", { tab: "song", panel: "part", selectedPart: 2 }),
  "desktop-song": running("song", { tab: "song", panel: "part", selectedPart: 2 }),
  "load-failed": { phase: "load-failed", mode: "loop", ui: {}, exportProgress: null, withError: false, withChange: false, collapsed: false },
  unsupported: { phase: "unsupported", mode: "loop", ui: {}, exportProgress: null, withError: false, withChange: false, collapsed: false },
} as const satisfies Record<string, ScreenPreset>;

export type ScreenName = keyof typeof SCREENS;

export function isScreenName(value: string | null): value is ScreenName {
  return value !== null && Object.hasOwn(SCREENS, value);
}
