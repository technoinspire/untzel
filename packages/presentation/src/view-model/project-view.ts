// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project's part of the view model: the song title the top
// bar shows, whether it is saved, and the projects stored on this device. The page builds
// it from the project library and the session; the views only read it.
/** "saved": stored after the last edit; "saving": an edit waits for its save; "blocked": storage refused. */
export type SaveState = "saved" | "saving" | "blocked";
export interface ProjectListItem {
  readonly id: string;
  /** The title read from the project's text when it was saved. */
  readonly title: string;
  /** "Edited 3 min ago". */
  readonly edited: string;
  /** "124 BPM · 6 tracks", once the engine's code has read the text; null before. */
  readonly detail: string | null;
  /** The project open now. */
  readonly isOpen: boolean;
}
export interface ProjectView {
  /** The song title in the bar; null with no project open (the bar shows "Untzel"). */
  readonly title: string | null;
  /** Null before the first save of a project that has not been edited. */
  readonly saveState: SaveState | null;
  /** What Save file writes: "midnight-coast.untzel". */
  readonly fileName: string;
  /** Private browsing or full storage: Duplicate and Delete are inert, the session is kept. */
  readonly isStorageBlocked: boolean;
  /** Most recent first. */
  readonly projects: readonly ProjectListItem[];
  /** The most recent stored project the waiting screen offers to continue. */
  readonly latest: { readonly id: string; readonly title: string } | null;
}
/** The view with no project open and nothing stored: the first visit. */
export const NO_PROJECT: ProjectView = {
  title: null,
  saveState: null,
  fileName: "",
  isStorageBlocked: false,
  projects: [],
  latest: null,
};
