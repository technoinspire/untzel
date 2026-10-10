// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_LOOP_BARS, type PatternBar } from "@untzel/core";
import {
  printNumber,
  setLoopBars,
  setStepCount,
  setTrackBars,
  setTrackModifier,
  setTrackParameter,
  suggest,
  type EditResult,
} from "@untzel/language";
import type { CommandContext } from "../reading/context";
import { error, type CommandOutcome } from "../proposal/outcome";
import { strings } from "../copy/copy";
import { SIGNAL_SHAPES, type ParameterInfo } from "../reading/vocabulary";
import { readNumber, type Word } from "../reading/words";

// set, tone, steps and bars: the edits of the track detail, written as words.

/** The step counts the track detail offers (TrackEdits.setStepCount in @untzel/session). */
const STEP_COUNTS: readonly number[] = [8, 16, 32];

const SIGNAL_RULE = new RegExp(`^(${SIGNAL_SHAPES.join("|")})\\(\\d+(\\.\\d+)?\\)( -?\\d+(\\.\\d+)?\\.\\.-?\\d+(\\.\\d+)?)?$`);

/** Steps of a bar as the grid shows them: one per hits character, one per other element. */
function stepsOf(bar: PatternBar): number {
  return bar.elements.reduce((sum, element) => sum + (element.kind === "hits" ? element.steps.length : 1), 0);
}

function instrumentOf(context: CommandContext, track: string): string {
  return context.names.tracks.find((entry) => entry.name === track)?.instrument ?? "";
}

function checkNumberValue(context: CommandContext, parameter: Extract<ParameterInfo, { kind: "number" }>, value: string, prefix: string): CommandOutcome | null {
  const number = readNumber(value);
  if (number !== null) {
    if (number >= parameter.min && number <= parameter.max && (!parameter.integer || Number.isInteger(number))) return null;
    const clamped = Math.min(Math.max(parameter.integer ? Math.round(number) : number, parameter.min), parameter.max);
    const message = parameter.integer
      ? strings.wholeBetween(parameter.name, parameter.min, parameter.max)
      : strings.between(parameter.name, parameter.min, parameter.max);
    return error(message, `${prefix} ${printNumber(clamped) ?? clamped}`);
  }
  if (!SIGNAL_RULE.test(value)) return error(strings.notANumber(value), `${prefix} ${parameter.example}`);
  if (!parameter.allowsSignal) return error(strings.numberOnly(parameter.name), `${prefix} ${parameter.example}`);
  if (value.includes("..")) return null;
  const range = `${printNumber(parameter.min)}..${printNumber(parameter.max)}`;
  return error(strings.signalNeedsRange(value, range), `${prefix} ${value} ${range}`);
}

/**
 * A near name when there is one; otherwise the track's own parameters in the message
 * and its first parameter, with its example value, as the suggested line.
 */
function unknownParameter(context: CommandContext, track: string, word: Word, parameters: readonly ParameterInfo[]): CommandOutcome {
  const message = strings.unknownParameter(track, word.text);
  const near = suggest(word.text, parameters.map((candidate) => candidate.name));
  if (near !== null) return error(message, context.suggestLine(word, near));
  const own = parameters.filter((candidate) => candidate.kind === "number" && candidate.instrument !== null);
  const listed = own.length > 0 ? own : parameters;
  const first = listed[0];
  if (first === undefined) return error(message);
  const value = first.kind === "flag" ? "" : ` ${first.example}`;
  return error(`${message} ${strings.parametersOf(track, listed.map((candidate) => candidate.name))}`, `set ${track} ${first.name}${value}`);
}

export function set(context: CommandContext): CommandOutcome {
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const word = context.argument(1, strings.setNeedsParameter);
  if (!word.ok) return word.outcome;
  const instrument = instrumentOf(context, track.value);
  const parameters = context.vocabulary.parametersOf(instrument);
  const parameter = parameters.find((candidate) => candidate.name === word.value.text);
  if (parameter === undefined) return unknownParameter(context, track.value, word.value, parameters);
  const prefix = `set ${track.value} ${parameter.name}`;
  const value = context.args.slice(2).map((entry) => entry.text).join(" ");
  if (parameter.kind === "flag") {
    if (value !== "") return error(strings.flagTakesNoValue(parameter.name), prefix);
    return context.propose(setTrackModifier(context.source, track.value, parameter.name, null), {
      title: context.line,
      summary: strings.flag(track.value, parameter.name),
      destructive: false,
    });
  }
  if (value === "") return error(strings.needs(strings.parameterNeedsValue(parameter.name), `${prefix} ${parameter.example}`), `${prefix} ${parameter.example}`);
  if (parameter.kind === "number") {
    const refused = checkNumberValue(context, parameter, value, prefix);
    if (refused !== null) return refused;
  }
  const edit = setTrackModifier(context.source, track.value, parameter.name, value);
  if (!edit.ok && edit.reason === "INVALID_VALUE") return error(strings.invalidValue(value, parameter.name), `${prefix} ${parameter.example}`);
  return context.propose(edit, { title: context.line, summary: strings.parameter(track.value, parameter.name, value), destructive: false });
}

export function tone(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const value = context.number(1, "tone", strings.toneNeedsValue, { min: 0, max: 1, integer: false });
  if (!value.ok) return value.outcome;
  return context.propose(setTrackParameter(context.source, track.value, "tone", value.value), {
    title: context.line,
    summary: strings.parameter(track.value, "tone", printNumber(value.value) ?? ""),
    destructive: false,
  });
}

export function steps(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const word = context.argument(1, strings.stepsNeedsCount);
  if (!word.ok) return word.outcome;
  const count = readNumber(word.value.text);
  if (count === null || !STEP_COUNTS.includes(count)) {
    return error(strings.oneOf("steps", STEP_COUNTS.map(String)), context.suggestLine(word.value, "16"));
  }
  const pattern = context.program?.tracks.find((entry) => entry.name === track.value)?.pattern;
  // Fewer steps drop the ones off the new grid; unknown (text with errors) counts as losing.
  const loses = pattern === undefined || pattern.bars.some((bar) => stepsOf(bar) > count);
  const edit = setStepCount(context.source, track.value, count, context.vocabulary.isPitched(instrumentOf(context, track.value)));
  if (!edit.ok && edit.reason === "INVALID_VALUE") return error(strings.stepsRefused(track.value, count));
  return context.propose(edit, { title: context.line, summary: strings.steps(track.value, count), destructive: loses });
}

export function bars(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const track = context.track(0);
  if (!track.ok) return track.outcome;
  const count = context.number(1, "bars", strings.barsNeedsCount, { min: 1, max: MAX_LOOP_BARS, integer: true });
  if (!count.ok) return count.outcome;
  const program = context.program;
  const current = program?.tracks.find((entry) => entry.name === track.value)?.pattern.bars.length ?? null;
  const loopBars = program?.loopBars ?? null;
  // As TrackEdits.setTrackBars: a written loop shorter than the pattern grows with it.
  const grown = (edit: EditResult): EditResult =>
    !edit.ok || loopBars === null || loopBars >= count.value ? edit : setLoopBars(edit.source, count.value);
  return context.propose(grown(setTrackBars(context.source, track.value, count.value)), {
    title: context.line,
    summary: strings.bars(track.value, count.value),
    destructive: current === null || count.value < current,
  });
}
