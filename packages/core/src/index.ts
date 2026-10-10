// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type { Rational } from "./time/rational";
export {
  add,
  compare,
  denominator,
  div,
  floor,
  fromDecimal,
  max,
  min,
  mul,
  numerator,
  rational,
  sub,
  toNumber,
} from "./time/rational";
export type { TimeSpan } from "./time/time-span";
export type { Event, EventValue, Pattern, SourceRange } from "./pattern/event";
export type {
  ArpMode,
  ArpSpec,
  HitStep,
  PatternAtom,
  PatternBar,
  PatternContext,
  PatternElement,
  PatternSpec,
  Voicing,
} from "./pattern/pattern-spec";
export { ARP_MODES, VOICINGS } from "./pattern/pattern-spec";
export { compilePattern } from "./pattern/compile-pattern";
export { applySwing } from "./time/swing";
export type { ChordQuality, Key, ScaleName } from "./pitch/pitch";
export { CHORD_QUALITIES, chordWord, stepPitchMidis, type StepPitch } from "./pitch/step-pitch";
export {
  CHORD_QUALITY_NAMES,
  SCALE_NAMES,
  chordNameToMidis,
  midiToNoteName,
  noteNameToMidi,
  pitchClassName,
  quantizeToScale,
  scalePitchClasses,
  tonicToPitchClass,
  transposeFromC,
} from "./pitch/pitch";
export {
  fmix32,
  fnv1a32,
  mix,
  mulberry32,
  normalizeSource,
  probabilityDraw,
  randomSignalDraw,
  sourceHash,
} from "./pattern/random";
export type { Curve, Signal, SignalShape, SignalValue } from "./pattern/signal";
export { SIGNAL_SHAPES, curvePosition, interp, signalAt } from "./pattern/signal";
export type { Arrangement, ArrangementPart, PartLocation } from "./time/arrangement";
export { SECTION_ONLY_PART_BARS, buildArrangement, locate } from "./time/arrangement";
export type { TempoOrigin } from "./time/tempo-origin";
export { barAt, createOrigin, frameAt, retempo } from "./time/tempo-origin";
export { originAtBar } from "./time/timeline";
export type {
  ConstantValue,
  DelayDivisionName,
  GeneralParameterName,
  ModulatorSpec,
  Program,
  ResolvedParameter,
  ReverbSpaceName,
  Section,
  Song,
  SongPart,
  Track,
} from "./program/program";
export {
  DelayDivision,
  GeneralParameter,
  INSTRUMENT_PARAMETER_OFFSET,
  ReverbSpace,
} from "./program/program";
export type {
  InstrumentEngine,
  InstrumentGroup,
  InstrumentKind,
  InstrumentManifest,
  InstrumentPreset,
  ManifestIssue,
  ManifestPattern,
  ManifestParameter,
  ManifestResult,
  ToneMapping,
  VoiceAllocation,
  VoiceSteal,
} from "./manifest/manifest";
export { INSTRUMENT_GROUPS, isPresetName, parseManifest, presetOf } from "./manifest/manifest";
export {
  SCENE_DRIVES,
  SCENE_FAMILIES,
  SCENE_SHAPES,
  SCENE_TINTS,
  isSceneFamily,
  isShapeOf,
  type SceneDensity,
  type SceneDrive,
  type SceneFamily,
  type SceneShape,
  type SceneSpec,
  type SceneTint,
  type SceneVariant,
} from "./manifest/scene-catalog";
export { MIN_RANGE_SEMITONES, type PitchRange } from "./pitch/pitch-range";
export type { CanonicalParameter, EngineName } from "./manifest/engine-parameters";
export { ENGINE_NAMES, ENGINE_PARAMETERS } from "./manifest/engine-parameters";
export type { LoopLength } from "./time/loop";
export { DEFAULT_LOOP_BARS, MAX_LOOP_BARS, MIN_LOOP_BARS, loopLengthOf, loopSectionOf } from "./time/loop";
export type { InstrumentRegistry } from "./manifest/registry";
export { createRegistry, instrumentId, instrumentNames } from "./manifest/registry";
export type { WrittenParameters, WrittenReverb, WrittenValue } from "./mix/parameters";
export type { EffectKind, EffectParameter } from "./manifest/effects";
export {
  EFFECT_KINDS,
  EFFECT_PARAMETERS,
  EFFECT_PARAMETER_OFFSET,
  effectParameter,
  effectParameterIndex,
} from "./manifest/effects";
export { resolveTrackModulators, resolveTrackParameters } from "./mix/parameters";
export { MAX_SUGGESTION_DISTANCE, editDistance } from "./program/edit-distance";
export { NAME_MAX_LENGTH, isWellFormedName } from "./program/names";
export {
  BELOW_FLOOR_POSITION,
  FADER_MAX_DB,
  FADER_MIN_DB,
  MAX_FADER_GAIN,
  UNITY_POSITION,
  dbToGain,
  dbToPosition,
  formatDb,
  gainLabel,
  gainToDb,
  gainToPosition,
  positionToDb,
  positionToGain,
  stepGain,
} from "./mix/fader-law";
export { toneOverriddenBy, type ToneOverride, type WrittenParameter } from "./mix/tone-override";
export { TRACK_COLOR_COUNT, trackColorIndex, trackHue } from "./program/track-color";
export {
  TITLE_MAX_CODE_POINTS,
  TITLE_SLUG_MAX_LENGTH,
  isTitleTooLong,
  normalizeTitle,
  titleLength,
  titleSlug,
  withPrefix,
  withSuffix,
} from "./program/song-title";
export {
  ModulatorCurve,
  ModulatorShape,
  envelopePosition,
  isAcceptedModulator,
  lfoPosition,
  modulatorValueAt,
  positionOfPhase,
  valueAt,
  type ModulatorInput,
  type ModulatorRange,
} from "./pattern/modulator-position";
