// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The controls' port over the real Session, one object per group of intents
// (packages/skin-contract/src/intents.ts). Every intent becomes a session use case: a
// TrackEdits edit or a transport command. Nothing here edits text or decides a value.

import type { TemplateCatalogView } from "@untzel/presentation/view-model";
import type { InstrumentRegistry } from "@untzel/core";
import {
  PatternEdits,
  PlayRanges,
  SongEdits,
  SoundEdits,
  StatementEdits,
  TrackEdits,
  type ArrangementSourceEditor,
  type PatternSourceEditor,
  type StatementSourceEditor,
  type Audition,
  type DiagnosticsLog,
  type NoteAudition,
  type PlayRangeSound,
  type Session,
  type SoundEditor,
  type SourceEditor,
} from "@untzel/session";
import { ExportControls, type ExportControlsOptions } from "./controls/export/export-controls";
import { ShareControls, type ShareControlsOptions } from "./controls/share-controls";
import { ControlsFeedback } from "./controls/feedback";
import type { GestureCoalescer } from "./controls/gesture-coalescer";
import { LibraryControls } from "./controls/library-controls";
import { PlaybackControls } from "./controls/playback-controls";
import { RangeControls } from "./controls/range-controls";
import { AuditionControls } from "./controls/audition-controls";
import { SongControls } from "./controls/song-controls";
import { SoundControls } from "./controls/sound-controls";
import { PatternControls } from "./controls/pattern-controls";
import { StatementControls } from "./controls/statement-controls";
import { TrackControls } from "./controls/track-controls";
import { SessionViewSource } from "./controls/view-source";

export interface SessionControlsOptions {
  readonly session: Session;
  /** Where the play range goes: the engine's SoundPort, the session's own. */
  readonly sound: PlayRangeSound;
  readonly editor: SourceEditor & ArrangementSourceEditor & StatementSourceEditor & PatternSourceEditor;
  readonly soundEditor: SoundEditor;
  readonly registry: InstrumentRegistry;
  /** The library's audition before adding. */
  readonly libraryAudition: Audition;
  readonly log: DiagnosticsLog;
  readonly templates: TemplateCatalogView;
  readonly selectedTemplate: string;
  /** Frame the context renders now; null before the first sound. */
  readonly nowFrame: () => number | null;
  readonly sampleRate: number;
  /** Called synchronously inside the play gesture, before the session plays. */
  readonly resumeAudio: () => void;
  /** Plays the notes the person touches, on the same preview path. */
  readonly audition: NoteAudition;
  /** Tests pass a coalescer with no delay. */
  readonly coalescer?: GestureCoalescer;
  readonly share: Omit<ShareControlsOptions, "session" | "ranges" | "announce" | "log">;
  readonly exporter: Omit<ExportControlsOptions, "session" | "announce">;
}

/** What the controls drive while running; start, retry and templates belong to the page. */
export interface RunningControls {
  /** The view, the announcements and the export sheet's format. */
  readonly view: SessionViewSource;
  readonly playback: PlaybackControls;
  readonly tracks: TrackControls;
  readonly audition: AuditionControls;
  readonly library: LibraryControls;
  readonly sound: SoundControls;
  readonly song: SongControls;
  /** The play range. */
  readonly range: RangeControls;
  /** The play range a project carries and gets back, beside the intents. */
  readonly ranges: Pick<PlayRanges, "rangeOf" | "receive" | "subscribe">;
  readonly statements: StatementControls;
  readonly patterns: PatternControls;
  readonly share: ShareControls;
  readonly exporter: ExportControls;
  /** The editor's "Line N changed" notice. */
  readonly feedback: ControlsFeedback;
  /** The same gestures for the composer terminal (drop). */
  readonly edits: TrackEdits;
  dispose(): void;
}

// Over 40 lines: one statement per controller, in the order they depend on each other.
export function createSessionControls(options: SessionControlsOptions): RunningControls {
  const { session, editor, registry } = options;
  const edits = new TrackEdits({ session, editor, registry });
  const feedback = new ControlsFeedback(session);
  const announce = (message: string): void => feedback.announce(message);
  const ranges = new PlayRanges(session, options.sound);
  const share = new ShareControls({ ...options.share, session, ranges, announce, log: options.log });
  const exporter = new ExportControls({ ...options.exporter, session, announce });
  const audition = options.libraryAudition;
  const range = new RangeControls({ ranges, session, feedback, exporter });
  const view = new SessionViewSource({ ...options, feedback, audition, ranges, sheets: { share, export: exporter } });
  const tracks = new TrackControls({ session, edits, feedback, ...(options.coalescer === undefined ? {} : { coalescer: options.coalescer }) });
  return {
    view,
    playback: new PlaybackControls({ session, edits, feedback, resumeAudio: options.resumeAudio }),
    tracks,
    audition: new AuditionControls({ session, registry, audition: options.audition }),
    library: new LibraryControls(session, edits, audition, feedback),
    sound: new SoundControls(new SoundEdits(session, options.soundEditor), feedback),
    song: new SongControls(session, edits, new SongEdits({ session, editor }), feedback),
    range,
    ranges,
    statements: new StatementControls(new StatementEdits(session, editor), feedback),
    patterns: new PatternControls(session, new PatternEdits(session, editor), feedback),
    share,
    exporter,
    feedback,
    edits,
    dispose: () => {
      tracks.dispose();
      range.dispose();
      ranges.dispose();
      view.dispose();
      exporter.dispose();
    },
  };
}
