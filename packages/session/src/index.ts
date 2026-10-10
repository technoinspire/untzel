// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type {
  ActivatedModulator,
  ActivatedTrack,
  BeatGrid,
  ClockPort,
  DiagnosticsLog,
  EventSink,
  LoadEstimate,
  LoadPort,
  LoadReading,
  ParameterPoint,
  PlaybackMode,
  PlaybackPosition,
  PlayRange,
  PlayRangeChange,
  PreviewPort,
  RangePartNames,
  PreviewSink,
  ProgramActivation,
  SavedSession,
  ScheduleFeed,
  ScheduledBatch,
  ScheduledEvent,
  SessionDependencies,
  ShareLink,
  NamedSourceEdit,
  NoteAudition,
  SoundPort,
  SourceEdit,
  SourceEditFailure,
  SourceEditor,
  ArrangementSourceEditor,
  PatternSourceEditor,
  StatementSourceEditor,
  SourceStore,
  StartResult,
  TempoChange,
  TitleSourceEditor,
  TransportStats,
  Unsubscribe,
} from "./ports";
export type {
  CommandFailure,
  CommandResult,
  HistoryResult,
  NamedCommandResult,
  SessionResult,
  SessionState,
} from "./use-cases/session";
export type { EditOptions, HistoryLabel } from "./use-cases/history";
export { PatternEdits } from "./edits/pattern-edits";
export { StatementEdits } from "./edits/statement-edits";
export { STARTER_INSTRUMENTS, startWithSound } from "./edits/starter-sounds";
export { TRACK_PREVIEW_BARS, previewProgram } from "./audition/track-preview";
export { soundingProgram, type SoundingParts, type SoundingRecipe } from "./sounding-program";
export { toneOverridesOf } from "./view/track-tone";
export { currentPatternOf } from "./view/current-pattern";
export type { TrackPreviewView } from "./view/view-preview";
export { Session } from "./use-cases/session";
export {
  PlayRanges,
  type PlaybackRanges,
  type PlayRangeFailure,
  type PlayRangeHost,
  type PlayRangeNotice,
  type PlayRangeRequest,
  type PlayRangeResult,
  type PlayRangeSound,
  type PlayRangeView,
} from "./use-cases/play-range-use-cases";
export { carriedRange, openingMode, type CarriedRange } from "./opening-mode";
// The export's stretch: finer than the play range, capped per format.
export {
  TICKS_PER_BAR,
  barBeatLabel,
  clampStretch,
  exportTimeMap,
  lastBarOf,
  secondsAtTick,
  stretchOfPlayRange,
  stretchSeconds,
  trimStretchToCap,
  type ExportStretch,
  type TimeMap,
} from "@untzel/transport";
export {
  DEFAULT_NOTE_OCTAVE,
  MAX_TRACK_BARS,
  STEP_COUNTS,
  TrackEdits,
  type TrackEditsDependencies,
  type ValueCommandResult,
} from "./edits/track-edits";
export { SongEdits, type SongEditsDependencies } from "./edits/song-edits";
export { TitleEdits, type TitleEditsDependencies, type TitleResult } from "./edits/title";
export {
  AuditionVoices,
  RETRIGGER_MS,
  SUSTAINED_AUDITION_MS,
  HIT_AUDITION_MIDI,
  auditionDurationMs,
  auditionKey,
  auditionMidis,
  type AuditionSound,
} from "./audition/audition";
export { parameterValueAt } from "./edits/parameter-fraction";
export type {
  ParameterView,
  SectionView,
  SessionView,
  SignalView,
  SongPartView,
  SongView,
  StepView,
  TrackStatus,
  TrackView,
} from "./view/view";
export { HISTORY_LIMIT } from "./use-cases/history";
export type { SoundEditor } from "./edits/sound-edits";
export { SoundEdits } from "./edits/sound-edits";
export type { AuditionDependencies, Auditioning } from "./audition/library-audition";
export { AUDITION_TRACK, Audition, auditionText } from "./audition/library-audition";
/** The name rule of the language, for the controls to anticipate it (they never import language). */
export { canPlay, checkName, type NameProblem, type PatternContent } from "./rules";
