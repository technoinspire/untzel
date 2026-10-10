// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type {
  BarIntents,
  ControlsPort,
  AuditionIntents,
  ExportChoiceIntents,
  ExportIntents,
  ExportJobIntents,
  ExportStretchIntents,
  LibraryIntents,
  MixIntents,
  PatternIntents,
  PlaybackIntents,
  RangeGesture,
  RangeIntents,
  RenameIntents,
  SessionIntents,
  ShareIntents,
  SongIntents,
  SoundIntents,
  StatementIntents,
  TrackIntents,
  ViewSource,
} from "@untzel/skin-contract";
export type { ProjectIntents } from "@untzel/skin-contract";
export type { MobileTab, Overlay, Panel, Shell, ShellOptions, UiState } from "./shell/shell";
export { createShell } from "./shell/shell";
export { miniSteps, MINI_STEPS, type MiniCell } from "./views/pattern/mini-steps";
export { shortcutFor, type KeyDescriptor, type ShortcutAction } from "@untzel/skin-contract";
// The English source catalog, for the docs generator, which renders every language at build
// time (the translations: `@untzel/skin-booth/pt-BR`); the app's adapters read `liveStrings`,
// the current language, and the composition adds a language with addControlsTranslations.
export { strings } from "./copy/strings";
export { addControlsTranslations, effectLabels, exportStretchPhrases, phrases as livePhrases, rangePhrases, strings as liveStrings, type ControlsTranslations } from "./copy/copy";
export { copyTitle, remixTitle } from "./behavior/text/song-title-model";
export { writeMotionAttribute, isReducedMotionDocument } from "@untzel/skin-contract";
export {
  effectiveReducedMotion,
  nextReducedMotionChoice,
  readReducedMotionChoice,
  writeReducedMotionChoice,
  type MotionChoice,
  type MotionPreferenceStore,
} from "@untzel/skin-contract";
export type { LanguageChoice, MenuLocale } from "./behavior/menu/language-choice";
export { clockLabel, exportCapNote } from "./views/export/export-stretch-words";
/** A piano key's accessible name ("eb4" → "E flat 4"), for tools that find keys as a reader does. */
export { spokenNote } from "./views/pattern/note-picker-model";
export { partSpanNames } from "./views/range/range-label";
export { ATTRIBUTION, createAttributionFooter, createAttributionLogo } from "./views/frame/attribution";
export { tempoAndKey } from "./behavior/text/format";
