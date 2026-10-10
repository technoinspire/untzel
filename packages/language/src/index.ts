// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import ptBrMessages from "./copy/messages.pt-BR";

export type { AnalyzeResult } from "./read/analyze";
export { MAX_SOURCE_LENGTH, analyze } from "./read/analyze";
/** The grammar's parser with highlighting tags, for the editor; meaning comes from analyze(). */
export { TOKEN_TAGS, untzelHighlighting, untzelParser, type TokenCategory } from "./highlight/highlight";
export type { Diagnostic, DiagnosticCode, DiagnosticFix, DiagnosticMessage, MessageArg } from "./diagnostics/diagnostics";
export { DIAGNOSTIC_CODES } from "./diagnostics/diagnostics";
export type {
  AppliedEdit,
  EditFailure,
  EditResult,
  FailedEdit,
  NamedEditResult,
  TextChange,
} from "./edits/text-changes";
export { printNumber } from "./edits/print";
export {
  addNamedTrack,
  addTrack,
  deleteTrack,
  duplicateTrack,
  removeTrackParameters,
  renameTrack,
  setTrackFree,
  setTrackMuted,
  setTrackModifier,
  setTrackParameter,
  toggleStep,
  unmuteAllTracks,
} from "./edits/track-edits";
export {
  addSection,
  declareSong,
  duplicatePart,
  movePart,
  renameSection,
  setPartBars,
  setSectionMembership,
  type PartLength,
} from "./edits/arrangement-edits";
export { clearBar, readBar, replaceBar } from "./edits/bar-edits";
export { pitchText, setStepPitch } from "./edits/pitch-edits";
export { dropEdit, moveLoop, toggleLoopMember } from "./edits/loop-section-edits";
export { setLoopBars, setStepCount, setTrackBars } from "./edits/length-edits";
export { addEffect, removeEffect, setInstrument, setSound } from "./edits/sound-edits";
export { patternInKey } from "./edits/pattern-key";
export { setTrackPattern } from "./edits/pattern-edits";
export { RESERVED_WORDS, checkName, type NameProblem } from "./vocabulary/name-rules";
export { atomContent, canPlay, patternContent, type PatternContent } from "./vocabulary/pattern-content";
export { setKey, setSection, setSong, setTempo, type SongPartText } from "./edits/statement-edits";
export { readNames, type DeclaredNames, type DeclaredSection, type DeclaredTrack } from "./vocabulary/names";
export { GENERAL_MODIFIER_RULES, type GeneralModifierRule } from "./vocabulary/general-modifier-rules";
export { suggest } from "./diagnostics/suggest";
export { nextFreeName } from "./vocabulary/track-names";
export {
  MAX_BARS_PER_PATTERN,
  MAX_NAME_LENGTH,
  MAX_PART_BARS,
  MAX_STEPS_PER_BAR,
  MAX_SWING,
  MAX_TEMPO,
  MIN_PART_BARS,
  MIN_TEMPO,
} from "./limits";
export type { LanguageFacts, ModifierFact, NumericFact } from "./vocabulary/facts";
export { LANGUAGE_FACTS } from "./vocabulary/facts";
export type { TokenKind, TokenSpan } from "./highlight/classify-tokens";
export { GRAMMAR_NODE_TYPES, classifyTokens, syntaxNodeTypes } from "./highlight/classify-tokens";
export type { MessageKey } from "./copy/messages";
export { englishMessages } from "./copy/messages";
/** Every translation of englishMessages, for bindCatalog. */
export const messageTranslations = [ptBrMessages] as const;
export { setTitleEdit } from "./edits/title-edits";
export { titleOf } from "./read/read-title";
export { lightSourceHash, productionHeader, stagePlanHash, stripMuteModifiers } from "./highlight/light-source";
