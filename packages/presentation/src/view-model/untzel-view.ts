// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Read-only view model the controls render. The composition builds it from the session
// state; controls never derive it from the source text.
import type { ExportView } from "./export-view";
import type { LibraryEntryView, AuditionView } from "./library-view";
import type { PlayRangeView } from "./play-range-view";
import type { ProjectView } from "./project-view";
import type { ShareView } from "./share-view";
import type { SongView } from "./song-view";
import type { TemplatesView } from "./templates-view";
import type { TrackView } from "./track-view";
import type { ScaleView, TransportView } from "./transport-view";

export type AppPhase = "idle" | "loading" | "running" | "load-failed" | "unsupported";

/** What one Undo or Redo changed: "gain" on "hat". */
export interface UndoNotice {
  readonly what: string;
  readonly target: string | null;
}

/** The touch Undo and Redo. */
export interface HistoryView {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface UntzelView {
  readonly phase: AppPhase;
  readonly transport: TransportView;
  readonly tracks: readonly TrackView[];
  readonly song: SongView;
  readonly playRange: PlayRangeView;
  readonly scale: ScaleView;
  readonly library: readonly LibraryEntryView[];
  readonly audition: AuditionView | null;
  readonly templates: TemplatesView;
  readonly share: ShareView;
  readonly export: ExportView;
  readonly history: HistoryView;
  /** Instruments of the empty state's starters (Kick, Bass, Hats, Chords) the library has. */
  readonly starters: readonly string[];
  readonly project: ProjectView;
}
