// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// English copy of the composer terminal: the source catalogs of @untzel/i18n, translated
// next to them (strings.pt-BR.ts) and read through copy.ts. Command names, usages and
// examples are code and stay English.

import type { InstrumentGroup, InstrumentKind } from "@untzel/core";
import { MAX_TEMPO, MIN_TEMPO } from "@untzel/language/limits";

/** The library's group names, as the controls show them. */
const GROUPS: Readonly<Record<InstrumentGroup, string>> = {
  drums: "Drums",
  bass: "Bass",
  keys: "Keys",
  plucks: "Plucks",
  pads: "Pads",
  brass: "Brass",
  leads: "Leads",
  voices: "Voices",
  fx: "FX",
};

/** What each kind of instrument plays, in words. */
const PLAYS: Readonly<Record<InstrumentKind, string>> = { drum: "plays hits", pitched: "plays notes", chord: "plays chords and notes" };

const TEMPO_RANGE = `${MIN_TEMPO} to ${MAX_TEMPO}`;

/** "1 bar", "8 bars". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "kick, hat and bass". */
function list(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1) ?? ""}`;
}

export const strings = {
  // errors
  unknownCommand: (word: string): string => `Unknown command "${word}".`,
  unknownTrack: (word: string): string => `No track named "${word}".`,
  unknownInstrument: (word: string): string => `No instrument named "${word}".`,
  unknownSection: (word: string): string => `No section named "${word}".`,
  unknownParameter: (track: string, word: string): string => `"${track}" has no parameter "${word}".`,
  parametersOf: (track: string, names: readonly string[]): string => `${track} has ${names.join(", ")}.`,
  unknownScale: (word: string): string => `No scale named "${word}".`,
  invalidTonic: (word: string): string => `"${word}" is not a tonic: use a letter from a to g, with b or #.`,
  invalidName: (word: string): string => `"${word}" can't be a name: start with a letter, then letters, digits, - or _.`,
  nameTaken: (word: string): string => `A track named "${word}" already exists.`,
  reservedName: (word: string): string => `"${word}" is a word of the language; pick another name.`,
  between: (what: string, min: number, max: number): string => `${what} must be between ${min} and ${max}.`,
  wholeBetween: (what: string, min: number, max: number): string => `${what} must be a whole number from ${min} to ${max}.`,
  oneOf: (what: string, choices: readonly string[]): string => `${what} must be ${choices.join(", ")}.`,
  needs: (what: string, example: string): string => `${what}, for example ${example}.`,
  tooMany: (usage: string): string => `Too many words. Usage: ${usage}`,
  notANumber: (word: string): string => `"${word}" is not a number.`,
  signalNeedsRange: (signal: string, range: string): string => `${signal} needs a range, for example ${range}.`,
  numberOnly: (name: string): string => `${name} takes a number, not a signal.`,
  flagTakesNoValue: (name: string): string => `${name} takes no value.`,
  invalidValue: (value: string, name: string): string => `"${value}" is not a value for ${name}.`,
  stepsRefused: (track: string, count: number): string =>
    `The bars of ${track} can't be split into ${count} steps; edit them in the code.`,
  editRefused: "That edit can't be made here; try it in the code.",
  sectionWouldBeEmpty: "That would leave a section with no tracks; change the section first.",
  nameTakenShort: "That name is taken.",
  noProgram: "Nothing is loaded yet: fix the code first.",
  nothingToFix: "Nothing to fix: every error left needs a choice in the code.",
  noChange: "Nothing to change: it is already so.",
  lineTooLong: (limit: number): string => `A command is at most ${limit} characters.`,
  // what a command is missing, completed by `needs` with the command's example
  needsTrack: (command: string): string => `${command} needs a track`,
  addNeedsInstrument: "add needs an instrument",
  renameNeedsName: "rename needs the new name",
  explainNeedsTarget: "explain needs a line number or a track",
  tempoNeedsBpm: "tempo needs a bpm",
  keyNeedsTonic: "key needs a tonic and a scale",
  keyNeedsScale: "key needs a scale",
  loopNeedsBars: "loop needs a number of bars",
  setNeedsParameter: "set needs a parameter",
  toneNeedsValue: "tone needs a value",
  stepsNeedsCount: "steps needs 8, 16 or 32",
  barsNeedsCount: "bars needs a number of bars",
  sectionNeedsName: "section needs a name and its tracks",
  sectionNeedsTracks: "section needs its tracks",
  songNeedsParts: "song needs parts like intro 8, separated by commas",
  parameterNeedsValue: (name: string): string => `${name} needs a value`,
  barsOfPart: (section: string): string => `bars of ${section}`,
  // results
  added: (name: string, line: number): string => `Added ${name} on line ${line}.`,
  removed: (name: string): string => `Removed ${name}.`,
  duplicated: (from: string, to: string, line: number): string => `Copied ${from} as ${to} on line ${line}.`,
  renamed: (from: string, to: string): string => `Renamed ${from} to ${to}.`,
  muted: (name: string): string => `${name} is off.`,
  unmuted: (name: string): string => `${name} is on.`,
  tempo: (bpm: string): string => `Tempo ${bpm} BPM.`,
  key: (tonic: string, scale: string): string => `Key ${tonic} ${scale}.`,
  loop: (bars: number): string => `Loop of ${plural(bars, "bar")}.`,
  parameter: (track: string, name: string, value: string): string => `${track}: ${name} ${value}.`,
  flag: (track: string, name: string): string => `${track}: ${name}.`,
  steps: (track: string, count: number): string => `${track}: ${count} steps per bar.`,
  bars: (track: string, count: number): string => `${track}: ${plural(count, "bar")}.`,
  section: (name: string, tracks: readonly string[]): string => `Section ${name}: ${tracks.join(" ")}.`,
  song: (parts: string): string => `Song: ${parts}.`,
  fixed: (count: number): string => `Fixed ${plural(count, "problem")}.`,
  // help
  helpIntro: "Commands. Type help <command> for one of them.",
  helpExample: (example: string): string => `For example: ${example}`,
} as const;

/** One short line per command, for help, completion and the usage hint; keyed by name. */
export const commandSummaries = {
  help: "list the commands, or explain one",
  add: "a new track",
  duplicate: "copy a track under the next free name",
  remove: "delete a track and its name in the sections",
  rename: "rename a track and the sections that use it",
  mute: "turn a track off on the next bar",
  unmute: "turn a track on on the next bar",
  solo: "hear one track alone; again to release",
  tempo: TEMPO_RANGE,
  key: "the key notes snap to",
  loop: "bars of one pass in loop mode, 1 to 16",
  set: "a number, or a signal with its range",
  tone: "the track's tone, 0 to 1",
  steps: "steps per bar",
  bars: "bars of the pattern, 1 to 16",
  section: "create a section or change its tracks",
  song: "write the song",
  play: "start the music",
  stop: "stop the music",
  drop: "turn every track on, in loop mode",
  fix: "apply every safe quick fix",
  explain: "what a line or a track does, in plain words",
  undo: "undo the last change",
  redo: "redo what was undone",
  clear: "clear the results",
} as const;

/** Details of completion options and the lines of hover help. */
export const assistStrings = {
  tonic: "tonic",
  scale: "scale",
  note: "note",
  rest: "rest",
  hold: "hold",
  chord: "chord",
  track: "track",
  section: "section",
  bars: "bars",
  steps: "steps",
  hits: "hits: x hit, X accent, . rest",
  tempoRange: TEMPO_RANGE,
  sectionGain: "0 to 1",
  signalOver: (shape: string): string => `${shape} signal over 8 bars`,
  flag: "a flag, no value",
  choice: (choices: readonly string[], example: string): string => `${choices.join(", ")}, for example ${example}`,
  range: (min: string, max: string, unit: string, integer: boolean, fallback: string): string =>
    `${min} to ${max}${unit === "" ? "" : ` ${unit}`}${integer ? ", whole numbers" : ""}, ${fallback}`,
  byDefault: (value: string): string => `default ${value}`,
  forExample: (value: string): string => `for example ${value}`,
  statementTitle: 'title "<name>", the song\'s name, up to 60 characters',
  statementTempo: `tempo <bpm>, ${TEMPO_RANGE}`,
  statementKey: "key <tonic> <scale>",
  statementSwing: "swing <amount>, 0 to 0.5",
  statementLoop: "loop <bars>, 1 to 16",
  statementSection: "section <name> <tracks…>",
  statementSong: "song <section bars, …>",
  hoverParameter: (name: string, instrument: string | null): string =>
    `${name} · ${instrument === null ? "general modifier" : `${instrument} parameter`}`,
  curve: (curve: string): string => (curve === "exponential" ? "exponential" : "linear"),
  hoverSignalTitle: (shape: string): string => `${shape}(<bars>) · signal`,
  hoverSignalBody: (shape: string): string => `${shape} shape over <bars> bars, between the two values of the range that follows`,
  hoverInstrumentTitle: (name: string): string => `${name} · instrument`,
  hoverInstrumentKind: (group: InstrumentGroup, kind: InstrumentKind): string => `${GROUPS[group]} · ${PLAYS[kind]}`,
  hoverPresetTitle: (sound: string, instrument: string): string => `${sound} · ${instrument} sound`,
  hoverInstrumentParameters: (parameters: readonly string[]): string =>
    parameters.length === 0 ? "no parameters of its own" : `parameters: ${parameters.join(", ")}`,
  hoverStatementTitle: (word: string): string => `${word} · statement`,
} as const;

/** `explain`: plain words, built the same way every time. */
export const explainStrings = {
  track: (name: string, instrument: string, kind: string | null): string =>
    `${name} is a ${instrument} track${kind === null ? "" : ` (${kind})`}.`,
  /** `what`: "drum", "chord" or "note", the kind of sound the pattern counts. */
  pattern: (bars: number, steps: readonly number[], sounds: number, what: string): string =>
    `Its pattern has ${plural(bars, "bar")} of ${steps.join(" or ")} steps, with ${sounds} ${what === "drum" ? "hits" : what === "chord" ? "chords" : "notes"} in all.`,
  sound: (described: readonly string[]): string => `Sound: ${described.join("; ")}.`,
  moves: (name: string, shape: string, period: number, low: string, high: string, unit: string): string =>
    `${name} moves with ${shape} over ${plural(period, "bar")}, ${low} to ${high}${unit}`,
  shapeSine: "a sine",
  shapeTri: "a triangle",
  shapeSaw: "a saw",
  shapeSquare: "a square",
  shapeRand: "a random step",
  muted: "It is off (mute): it joins on drop or unmute.",
  free: "It ignores the key (free).",
  noSection: "No section uses it, so it only plays in loop mode.",
  sections: (names: readonly string[]): string => `It plays in ${list(names)}.`,
  tempo: (bpm: number, seconds: string): string => `Tempo ${bpm}: ${bpm} beats per minute, so a bar of four beats lasts ${seconds} seconds.`,
  keyChromatic: (tonic: string): string => `Key ${tonic} chromatic: notes play as written, nothing snaps.`,
  key: (tonic: string, scale: string): string => `Key ${tonic} ${scale}: notes of pitched tracks snap to this scale.`,
  swing: (value: string): string => `Swing ${value}: every second step plays a little late, for a looser groove.`,
  loop: (bars: number): string => `Loop mode plays passes of ${plural(bars, "bar")}; every pattern starts again on each pass.`,
  section: (name: string, tracks: readonly string[], tempo: number | null, gain: number): string =>
    `Section ${name} plays ${list(tracks)}${tempo === null ? "" : ` at ${tempo} BPM`}${gain === 1 ? "" : ` at gain ${gain}`}.`,
  songPart: (section: string, bars: number): string => `${section} for ${plural(bars, "bar")}`,
  song: (parts: readonly string[], total: number, loops: boolean): string =>
    `The song plays ${list(parts)}: ${plural(total, "bar")} in all, then it ${loops ? "starts again" : "stops"}.`,
  line: (number: number, text: string): string => `Line ${number}: ${text}`,
  empty: (number: number): string => `Line ${number} is empty.`,
  comment: (number: number): string => `Line ${number} is a comment: notes for people, it never sounds.`,
  hasErrors: (number: number): string => `Line ${number} can't be explained while the code has errors; the last valid version keeps playing.`,
  tryFix: "Type fix to correct what is safe.",
  noTarget: (word: string): string => `No track or section named "${word}".`,
  noLine: (number: number, lines: number): string => `There is no line ${number}; the code has ${lines}.`,
} as const;
