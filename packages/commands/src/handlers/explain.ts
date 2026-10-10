// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { pitchClassName, toNumber, type PatternBar, type Program, type Track } from "@untzel/core";
import { suggest } from "@untzel/language";
import type { CommandContext } from "../reading/context";
import { error, info, type CommandOutcome } from "../proposal/outcome";
import { explainStrings as say, strings } from "../copy/copy";
import { readNumber } from "../reading/words";

// `explain <line|track>`: plain English built from the program and the line as written.
// Deterministic and local: the same text always gives the same words.

const SIGNAL = /^(sine|tri|saw|square|rand)\((\d+(?:\.\d+)?)\)\s+(-?[\d.]+)\.\.(-?[\d.]+)$/;
const FLAGS = /^(mute|free)\b/;

function withoutComment(line: string): string {
  const at = line.indexOf("//");
  return (at === -1 ? line : line.slice(0, at)).trim();
}

function unitOf(context: CommandContext, instrument: string, name: string): string {
  const parameter = context.vocabulary.parameter(instrument, name);
  return parameter?.kind === "number" && parameter.unit !== "" ? ` ${parameter.unit}` : "";
}

/** "cutoff sine(8) 300..1400" -> "cutoff moves with a sine over 8 bars, 300 to 1400 Hz". */
function describeModifier(context: CommandContext, instrument: string, text: string): string {
  const [name = "", ...rest] = text.split(/\s+/);
  const value = rest.join(" ");
  const unit = unitOf(context, instrument, name);
  const signal = SIGNAL.exec(value);
  if (signal === null) return value === "" ? name : `${name} ${value}${unit}`;
  const [, shape = "", period = "", low = "", high = ""] = signal;
  return say.moves(name, shapeName(shape), Number(period), low, high, unit);
}

/** "a sine", "a triangle"… in the current language; the word itself for an unknown one. */
function shapeName(shape: string): string {
  switch (shape) {
    case "sine":
      return say.shapeSine;
    case "tri":
      return say.shapeTri;
    case "saw":
      return say.shapeSaw;
    case "square":
      return say.shapeSquare;
    case "rand":
      return say.shapeRand;
    default:
      return shape;
  }
}

function stepsOf(bar: PatternBar): number {
  return bar.elements.reduce((sum, element) => sum + (element.kind === "hits" ? element.steps.length : 1), 0);
}

function soundsOf(bar: PatternBar): number {
  return bar.elements.reduce((sum, element) => {
    if (element.kind === "hits") return sum + element.steps.filter((step) => step === "hit" || step === "accent").length;
    return sum + (element.kind === "sustain" ? 0 : 1);
  }, 0);
}

function explainTrack(context: CommandContext, program: Program, track: Track, lineText: string): CommandOutcome {
  const manifest = context.vocabulary.manifest(track.instrument);
  const bars = track.pattern.bars;
  const steps = [...new Set(bars.map(stepsOf))];
  const sounds = bars.reduce((sum, bar) => sum + soundsOf(bar), 0);
  const what = manifest?.kind === "drum" || manifest?.kind === "chord" ? manifest.kind : "note";
  const lines = [
    say.track(track.name, track.instrument, manifest === undefined ? null : `${manifest.group}, ${manifest.kind}`),
    say.pattern(bars.length, steps, sounds, what),
  ];
  const modifiers = withoutComment(lineText)
    .split("|")
    .slice(1)
    .map((part) => part.trim())
    .filter((part) => part !== "" && !FLAGS.test(part));
  if (modifiers.length > 0) lines.push(say.sound(modifiers.map((part) => describeModifier(context, track.instrument, part))));
  if (track.muted) lines.push(say.muted);
  if (track.free) lines.push(say.free);
  const sections = program.sections.filter((section) => section.tracks.includes(track.name)).map((section) => section.name);
  if (program.sections.length > 0) lines.push(sections.length === 0 ? say.noSection : say.sections(sections));
  return info(...lines);
}

function explainStatement(context: CommandContext, program: Program, text: string, number: number): CommandOutcome | null {
  const [head = "", first = ""] = text.split(/\s+/);
  switch (head) {
    case "tempo": {
      const bpm = toNumber(program.tempo);
      return info(say.tempo(bpm, (240 / bpm).toFixed(2)));
    }
    case "key": {
      const tonic = pitchClassName(program.key.tonic);
      return info(program.key.scale === "chromatic" ? say.keyChromatic(tonic) : say.key(tonic, program.key.scale));
    }
    case "swing":
      return info(say.swing(first));
    case "loop":
      return program.loopBars === null ? null : info(say.loop(program.loopBars));
    case "section": {
      const section = program.sections.find((entry) => entry.name === first);
      return section === undefined ? null : info(say.section(section.name, section.tracks, section.tempo === null ? null : toNumber(section.tempo), section.gain));
    }
    case "song": {
      const song = program.song;
      if (song === null) return null;
      const total = song.parts.reduce((sum, part) => sum + part.bars, 0);
      return info(say.song(song.parts.map((part) => say.songPart(part.section, part.bars)), total, song.loop));
    }
    default: {
      const named = context.names.tracks.find((entry) => entry.line === number);
      const track = program.tracks.find((entry) => entry.name === named?.name);
      return track === undefined ? null : explainTrack(context, program, track, text);
    }
  }
}

function explainLine(context: CommandContext, number: number): CommandOutcome {
  const lines = context.source.split(/\r?\n/);
  const raw = number >= 1 ? lines[number - 1] : undefined;
  if (raw === undefined) return error(say.noLine(number, lines.length), `explain ${Math.min(Math.max(1, number), lines.length)}`);
  const text = withoutComment(raw);
  if (text === "") return info(raw.trim() === "" ? say.empty(number) : say.comment(number));
  const program = context.program;
  if (program === null) return info(say.hasErrors(number), say.tryFix);
  return explainStatement(context, program, text, number) ?? info(say.line(number, text));
}

export function explain(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const word = context.argument(0, strings.explainNeedsTarget);
  if (!word.ok) return word.outcome;
  const number = readNumber(word.value.text);
  if (number !== null && Number.isInteger(number)) return explainLine(context, number);
  const target =
    context.names.tracks.find((track) => track.name === word.value.text) ??
    context.names.sections.find((section) => section.name === word.value.text);
  if (target !== undefined) return explainLine(context, target.line);
  const candidates = [...context.names.tracks.map((track) => track.name), ...context.names.sections.map((section) => section.name)];
  const near = suggest(word.value.text, candidates);
  return error(say.noTarget(word.value.text), near === null ? null : context.suggestLine(word.value, near));
}
