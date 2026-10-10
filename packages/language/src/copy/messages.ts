// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Every English diagnostic message: the source catalog of @untzel/i18n, translated next
// to it (messages.pt-BR.ts). The codes are the contract; these texts are not.
import { referenced } from "@untzel/i18n";
import type { PatternContent } from "../vocabulary/pattern-content";

function didYouMean(suggestion: string | null): string {
  return suggestion === null ? "" : ` Did you mean "${suggestion}"?`;
}

function plural(count: number, noun: string): string {
  const grouped = String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped} ${noun}`;
}

export const englishMessages = {
  sourceTooLong: (limit: number): string => `A song can have at most ${plural(limit, "characters")}.`,
  internalError: (): string => "Something went wrong while reading this text.",
  unexpected: (text: string): string => `Unexpected "${text}".`,
  unexpectedEnd: (): string => "Unexpected end of line.",
  invalidNote: (text: string, suggestion: string | null = null): string => `"${text}" is not a note.${didYouMean(suggestion)}`,
  unknownStatement: (word: string, suggestion: string | null): string =>
    `Unknown statement "${word}".${didYouMean(suggestion)}`,
  unknownSignal: (word: string, suggestion: string | null): string => `Unknown signal "${word}".${didYouMean(suggestion)}`,
  unknownInstrument: (name: string, suggestion: string | null): string =>
    `Unknown instrument "${name}".${didYouMean(suggestion)}`,
  duplicateTrack: (name: string, line: number): string =>
    `A track named "${name}" already exists on line ${line}.`,
  duplicateSection: (name: string, line: number): string =>
    `A section named "${name}" already exists on line ${line}.`,
  unknownTrack: (section: string, track: string, suggestion: string | null = null): string =>
    `Section "${section}" uses "${track}", but no track has that name.${didYouMean(suggestion)}`,
  unknownSection: (section: string, suggestion: string | null = null): string =>
    `The song uses "${section}", but no section has that name.${didYouMean(suggestion)}`,
  unknownModifier: (instrument: string, name: string, suggestion: string | null): string =>
    `"${instrument}" has no parameter "${name}".${didYouMean(suggestion)}`,
  unknownSectionModifier: (name: string, suggestion: string | null): string =>
    `A section only takes tempo, gain and loop, not "${name}".${didYouMean(suggestion)}`,
  unknownScale: (name: string, suggestion: string | null): string =>
    `Unknown scale "${name}".${didYouMean(suggestion)}`,
  between: (name: string, min: number, max: number): string => `${name} must be between ${min} and ${max}.`,
  wholeBetween: (name: string, min: number, max: number): string =>
    `${name} must be a whole number between ${min} and ${max}.`,
  noValue: (name: string): string => `${name} takes no value.`,
  noSignal: (name: string): string => `${name} takes a number, not a signal.`,
  reverbValue: (suggestion: string | null = null): string =>
    `reverb must be small, wide, sea, room, plate, hall, dub or a number between 0 and 1.${didYouMean(suggestion)}`,
  delayValue: (): string => "delay must be 1/8, 3/16 or 1/4.",
  signalPeriod: (max: number): string => `A signal period must be above 0 and at most ${max} bars.`,
  signalNeedsRange: (signal: string, example: string): string =>
    `${signal} needs a range, for example ${example}.`,
  probability: (): string => "A probability must be between 0 and 1.",
  repeat: (min: number, max: number): string => `A repeat must be a whole number from ${min} to ${max}.`,
  groupDepth: (max: number): string => `Groups can be nested at most ${max} deep.`,
  partBars: (min: number, max: number): string => `A part must last from ${min} to ${max} bars.`,
  missingValue: (name: string, example: string): string => `${name} needs a value, for example ${example}.`,
  emptyPattern: (): string => "This track has no steps.",
  tooManySteps: (max: number): string => `A bar can have at most ${max} steps.`,
  tooManyBars: (max: number): string => `A pattern can have at most ${max} bars.`,
  nameTooLong: (max: number): string => `A name can have at most ${max} characters.`,
  kindMismatch: (instrument: string, plays: readonly PatternContent[], found: PatternContent): string =>
    `"${instrument}" plays ${plays.join(" and ")}, not ${found}.`,
  duplicateSong: (): string => "A text can have only one song.",
  duplicateStatement: (name: string, line: number): string => `${name} is already set on line ${line}.`,
  emptyTitle: (): string => "The song title is empty; the last title stays.",
  titleTooLong: (limit: number): string => `A song title can have at most ${limit} characters.`,
  duplicateModifier: (name: string): string => `${name} is set twice; the last one wins.`,
  globalsFirst: (name: string): string => `${name} comes before tracks, sections and the song.`,
  tracksBeforeSections: (): string => "Sections come after tracks.",
  sectionsBeforeSong: (): string => "The song comes after tracks and sections.",
  envelopeSeconds: (min: number, max: number): string => `env takes a time from ${min} to ${max} seconds.`,
  slowSignalOnly: (name: string): string => `"${name}" takes a slow signal; use a period of 1 bar or more.`,
  fastPeriod: (): string => "A fast signal can be as short as 1/64 of a bar.",
  randDivision: (): string => "rand below one bar needs a multiple of 1/16, for example rand(1/8).",
  unknownPreset: (instrument: string, sound: string, suggestion: string | null): string =>
    `"${instrument}" has no sound "${sound}".${didYouMean(suggestion)}`,
  unknownChoice: (name: string, choices: readonly string[], suggestion: string | null = null): string =>
    `"${name}" can be ${choices.slice(0, -1).join(", ")} or ${choices[choices.length - 1] ?? ""}.${didYouMean(suggestion)}`,
  choiceNeedsName: (name: string): string => `"${name}" takes a name, not a signal.`,
  // NO_EFFECT, one message per reason so each translates whole.
  noEffectWithoutChords: (what: string, instrument: string): string =>
    `${what} needs a chord instrument; "${instrument}" does not play chords.`,
  noEffectWithoutArp: (what: string): string => `${what} needs arp, for example arp up.`,
  noEffectWithoutMono: (what: string, instrument: string, playsChords: boolean): string =>
    `${what} needs a one-voice instrument; "${instrument}" plays ${playsChords ? "chords" : "several voices"}.`,
  tooManyModulators: (max: number): string => `A track can have at most ${max} fast signals.`,
  duplicateLoopSection: (name: string, line: number): string =>
    `Only one section can be the loop; "${name}" already is on line ${line}.`,
  accentNeedsHit: (): string => "! needs a hit or a note before it.",
  stackSize: (min: number, max: number): string => `A stack has ${min} to ${max} notes.`,
  arpRate: (rates: readonly string[]): string => `arp-rate can be ${rates.join(", ")}.`,
  keywordWithSound: (word: string): string => `"${word}" is a statement, not an instrument.`,
  nothingToPlay: (): string => "Nothing to play: add a track.",
  // Titles of the quick fixes, short enough for a button.
  fixChange: (to: string): string => `Change to ${to}`,
  fixAddRange: (range: string): string => `Add the range ${range}`,
  fixAddValue: (example: string): string => `Write ${example}`,
  fixRemoveEarlier: (name: string): string => `Remove the earlier ${name}`,
  fixRename: (name: string): string => `Rename to "${name}"`,
  fixChangeEvery: (from: string, to: string): string => `Change every ${from} to ${to}`,
} as const;

/** The key of one diagnostic message; stable across locales. */
export type MessageKey = keyof typeof englishMessages;

/** Each call returns { key, args, text }: the English text now, a translation in the view. */
export const messages = referenced(englishMessages);
