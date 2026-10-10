// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How a value of the text is reached on the track's detail: a slider gives a position
// 0..1000, which the session turns into a value through
// the manifest's curve and rounds; the gain fader moves 0.5 dB an arrow; an effect's slider
// shows once the effect is added. When no position writes the template's value exactly, the
// value is typed at the end of the track's line, the same text setTrackParameter writes. Pure.
import { EFFECT_PARAMETERS, effectParameter, stepGain, type EffectKind, type InstrumentManifest, type InstrumentRegistry } from "@untzel/core";
import { analyze, printNumber } from "@untzel/language";
import { parameterValueAt } from "@untzel/session";
import { readModifiers, statementText } from "../../../script/template";

/** A range slider's positions: the input's min to max. */
export const SLIDER_RESOLUTION = 1000;

/** The arrows tried on the gain fader, each way: 30 dB from unity. */
const MAX_GAIN_ARROWS = 60;

export type ParameterGesture =
  /** `addEffect` first when the slider belongs to an effect the track does not have yet. */
  | { readonly kind: "slider"; readonly slider: string; readonly position: number; readonly addEffect: EffectKind | null }
  /** Only `addEffect`: the effect's starting value is the template's. */
  | { readonly kind: "effect"; readonly addEffect: EffectKind }
  /** Arrow presses on the gain fader, from the gain sounding now (up when positive); 0: a double click, 0 dB. */
  | { readonly kind: "gain"; readonly arrows: number }
  /** Typed in the Code panel at the end of the track's line. */
  | { readonly kind: "code"; readonly text: string };

/** The positions that write `value`, middle one first: the steadiest under a hand. */
function positionFor(write: (fraction: number) => number | null, value: number): number | null {
  const hits: number[] = [];
  for (let position = 0; position <= SLIDER_RESOLUTION; position += 1) {
    if (write(position / SLIDER_RESOLUTION) === value) hits.push(position);
  }
  return hits[Math.floor(hits.length / 2)] ?? null;
}

function gainArrows(value: number): number | null {
  for (const direction of [1, -1]) {
    let gain = 1;
    for (let arrows = 1; arrows <= MAX_GAIN_ARROWS; arrows += 1) {
      gain = stepGain(gain, direction);
      if (gain === value) return direction * arrows;
    }
  }
  return value === 1 ? 0 : null;
}

function typed(parameter: string, value: number): ParameterGesture {
  return { kind: "code", text: ` | ${parameter} ${printNumber(value) ?? String(value)}` };
}

function effectGesture(parameter: string, value: number, written: ReadonlySet<string>): ParameterGesture {
  const definition = effectParameter(parameter);
  if (definition === undefined) return typed(parameter, value);
  const hasEffect = EFFECT_PARAMETERS.some((entry) => entry.effect === definition.effect && written.has(entry.name));
  const write = (fraction: number): number | null => parameterValueAt(undefined, parameter, fraction);
  if (hasEffect) {
    const position = positionFor(write, value);
    return position === null ? typed(parameter, value) : { kind: "slider", slider: parameter, position, addEffect: null };
  }
  // Adding an effect writes its first parameter; any other one would come with it.
  if (definition.added === null) return typed(parameter, value);
  if (definition.added === value) return { kind: "effect", addEffect: definition.effect };
  const position = positionFor(write, value);
  return position === null ? typed(parameter, value) : { kind: "slider", slider: parameter, position, addEffect: definition.effect };
}

/**
 * The gesture that writes `parameter value` on a track of `manifest` whose line already has
 * the modifiers `written`.
 */
export function parameterGesture(manifest: InstrumentManifest, parameter: string, value: number, written: ReadonlySet<string>): ParameterGesture {
  if (written.has(parameter) && effectParameter(parameter) === undefined) throw new Error(`${parameter} is written already: the demo sets each value once`);
  if (parameter === "gain") {
    const arrows = gainArrows(value);
    return arrows === null ? typed(parameter, value) : { kind: "gain", arrows };
  }
  if (parameter === "tone") {
    const position = Math.round(value * SLIDER_RESOLUTION);
    return position / SLIDER_RESOLUTION === value ? { kind: "slider", slider: "tone", position, addEffect: null } : typed(parameter, value);
  }
  if (effectParameter(parameter) !== undefined && !manifest.parameters.some((entry) => entry.name === parameter)) return effectGesture(parameter, value, written);
  const position = positionFor((fraction) => parameterValueAt(manifest, parameter, fraction), value);
  return position === null ? typed(parameter, value) : { kind: "slider", slider: parameter, position, addEffect: null };
}

/** The modifier names the line of `track` already has in `source`. */
export function writtenModifiers(track: string, source: string, registry: InstrumentRegistry): ReadonlySet<string> {
  const analysis = analyze(source, registry);
  const found = analysis.ok ? analysis.program.tracks.find((entry) => entry.name === track) : undefined;
  if (found === undefined) return new Set();
  return new Set(readModifiers(statementText(source.slice(found.source.from, found.source.to))).map((modifier) => modifier.name));
}
