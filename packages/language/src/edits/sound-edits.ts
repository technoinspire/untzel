// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_KINDS, EFFECT_PARAMETERS, type EffectKind, type InstrumentManifest } from "@untzel/core";
import { DiagnosticList } from "../diagnostics/diagnostics";
import { GENERAL_MODIFIERS } from "../read/modifier-values";
import { canPlay, patternContent } from "../vocabulary/pattern-content";
import { readPattern } from "../read/read-pattern";
import { EditableSource, type NamedTrack } from "./document";
import { printNumber } from "./print";
import { applyChanges, failure, type EditResult, type TextChange } from "./text-changes";
import { declarationOf, pinShiftedNames } from "./track-edits";

// The sound and the effects of a track from the track detail.
// Each is one minimal edit: comments and spacing stay as written.

function withTrack(source: string, track: string, edit: (document: EditableSource, found: NamedTrack) => EditResult): EditResult {
  const document = new EditableSource(source);
  const found = document.track(track);
  return found === null ? failure("UNKNOWN_TRACK") : edit(document, found);
}

/**
 * Writes the named sound after the instrument (`piano bright`); the default sound, or
 * null, removes the word.
 */
export function setSound(source: string, track: string, manifest: InstrumentManifest, sound: string | null): EditResult {
  if (sound !== null && !manifest.presets.some((preset) => preset.name === sound)) return failure("INVALID_NAME");
  return withTrack(source, track, (document, found) => {
    const word = sound === null || sound === manifest.defaultPreset ? null : sound;
    const current = found.syntax.preset;
    if (current === null) {
      if (word === null) return applyChanges(source, []);
      const at = found.syntax.instrument.to;
      return applyChanges(source, [{ from: at, to: at, insert: ` ${word}` }]);
    }
    if (word === null) return applyChanges(source, [{ from: document.blankStart(current.from), to: current.to, insert: "" }]);
    return applyChanges(source, [{ from: current.from, to: current.to, insert: word }]);
  });
}

/** The words of an instrument and its sound: `acid squelch`, or `acid` for the default sound. */
function soundWords(manifest: InstrumentManifest, preset: string | null): string {
  return preset === null || preset === manifest.defaultPreset ? manifest.name : `${manifest.name} ${preset}`;
}

/** An unnamed track is named after its instrument: it keeps its name when the instrument changes. */
function keepNames(document: EditableSource, found: NamedTrack, instrument: string): TextChange[] {
  const { syntax } = found;
  const own: TextChange[] = syntax.name === null ? [{ from: syntax.instrument.from, to: syntax.instrument.from, insert: `${found.name}: ` }] : [];
  const pinnedName = { text: found.name, from: 0, to: 0 };
  const pins = pinShiftedNames(document, found, (candidate) =>
    candidate === found ? { name: pinnedName, instrument } : declarationOf(candidate),
  );
  return [...own, ...pins];
}

/**
 * Change sound: another instrument and sound for the track, keeping the
 * pattern, the general modifiers (gain, pan, tone, mute, effects…) and the parameters the
 * new instrument also has; the others go. Refused when the new instrument cannot play
 * the pattern (canPlay, the rule the analysis checks).
 */
export function setInstrument(source: string, track: string, manifest: InstrumentManifest, preset: string | null): EditResult {
  if (preset !== null && !manifest.presets.some((entry) => entry.name === preset)) return failure("INVALID_NAME");
  return withTrack(source, track, (document, found) => {
    const { syntax } = found;
    const content = syntax.pattern === null ? [] : patternContent(readPattern(syntax.pattern, source, null, new DiagnosticList()).spec);
    if (!canPlay(manifest.kind, content)) return failure("INVALID_VALUE");
    const kept = new Set([...GENERAL_MODIFIERS, ...manifest.parameters.map((parameter) => parameter.name)]);
    const dropped = syntax.modifiers.filter((modifier) => !kept.has(modifier.name.text)).map((modifier) => document.removeModifier(modifier));
    const words: TextChange = { from: syntax.instrument.from, to: (syntax.preset ?? syntax.instrument).to, insert: soundWords(manifest, preset) };
    // The words first: applyChanges keeps the order of changes at one offset, and the
    // name goes in front of the words that replace the instrument.
    return applyChanges(source, [words, ...keepNames(document, found, manifest.name), ...dropped]);
  });
}

/** The modifier names of one effect: `eq` has eq-low, eq-mid, eq-mid-freq and eq-high. */
export function effectModifiers(effect: EffectKind): readonly string[] {
  return EFFECT_PARAMETERS.filter((parameter) => parameter.effect === effect).map((parameter) => parameter.name);
}

/**
 * Appends `| <modifier> <value>` with the effect's starting value at the end of the
 * line, so it comes last in the chain. No change when the track already has it.
 */
export function addEffect(source: string, track: string, effect: EffectKind): EditResult {
  if (!EFFECT_KINDS.includes(effect)) return failure("INVALID_NAME");
  const starter = EFFECT_PARAMETERS.find((parameter) => parameter.effect === effect && parameter.added !== null);
  const printed = starter?.added === undefined || starter.added === null ? null : printNumber(starter.added);
  if (starter === undefined || printed === null) return failure("INVALID_VALUE");
  return withTrack(source, track, (_, found) => {
    const names = new Set(effectModifiers(effect));
    if (found.syntax.modifiers.some((modifier) => names.has(modifier.name.text))) return applyChanges(source, []);
    const at = found.syntax.to;
    return applyChanges(source, [{ from: at, to: at, insert: ` | ${starter.name} ${printed}` }]);
  });
}

/** Removes every modifier of the effect from the line, in one edit. */
export function removeEffect(source: string, track: string, effect: EffectKind): EditResult {
  const names = new Set(effectModifiers(effect));
  return withTrack(source, track, (document, found) =>
    applyChanges(source, found.syntax.modifiers.filter((modifier) => names.has(modifier.name.text)).map((modifier) => document.removeModifier(modifier))),
  );
}
