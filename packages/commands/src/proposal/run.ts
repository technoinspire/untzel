// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { suggest, type AnalyzeResult } from "@untzel/language";
import { COMMAND_NAMES } from "../reading/catalog";
import { CommandContext } from "../reading/context";
import { section, song } from "../handlers/arrangement-commands";
import { explain } from "../handlers/explain";
import { key, loop, tempo } from "../handlers/global-commands";
import { bars, set, steps, tone } from "../handlers/parameter-commands";
import { action, clear, fix, help } from "../handlers/session-commands";
import { add, duplicate, mute, remove, rename, solo } from "../handlers/track-commands";
import { error, type CommandOutcome } from "./outcome";
import { strings } from "../copy/copy";
import { setLineFor } from "../reading/synonyms";
import type { Vocabulary } from "../reading/vocabulary";
import { MAX_LINE_LENGTH, replaceWord, splitWords } from "../reading/words";

type Handler = (context: CommandContext) => CommandOutcome;

const HANDLERS: Readonly<Record<string, Handler>> = {
  help,
  add,
  duplicate,
  remove,
  rename,
  mute: (context) => mute(context, true),
  unmute: (context) => mute(context, false),
  solo,
  tempo,
  key,
  loop,
  set,
  tone,
  steps,
  bars,
  section,
  song,
  play: (context) => action(context, "play"),
  stop: (context) => action(context, "stop"),
  drop: (context) => action(context, "drop"),
  fix,
  explain,
  undo: (context) => action(context, "undo"),
  redo: (context) => action(context, "redo"),
  clear,
};

export interface RunOptions {
  readonly source: string;
  readonly vocabulary: Vocabulary;
  readonly analyze: (source: string) => AnalyzeResult;
}

/** Reads one command line against the current text. Never throws, never evaluates. */
export function runLine(line: string, options: RunOptions): CommandOutcome {
  if (line.length > MAX_LINE_LENGTH) return error(strings.lineTooLong(MAX_LINE_LENGTH));
  const typed = splitWords(line);
  const first = typed[0];
  if (first === undefined) return { kind: "empty" };
  // One blank between words and the command in lower case ("Tempo  124" is "tempo 124").
  const name = first.text.toLowerCase();
  const normalized = [name, ...typed.slice(1).map((word) => word.text)].join(" ");
  const [head, ...args] = splitWords(normalized);
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : undefined;
  if (head === undefined || handler === undefined) {
    // `gain kick 0.5` and `kick gain 0.5` are `set kick gain 0.5` in another order.
    const synonym = setLineFor(typed.map((word) => word.text), options.source, options.vocabulary);
    const near = suggest(name, COMMAND_NAMES);
    const suggestion = synonym ?? (near === null || head === undefined ? null : replaceWord(normalized, head, near));
    return error(strings.unknownCommand(first.text), suggestion);
  }
  return handler(new CommandContext({ ...options, line: normalized, command: name, args }));
}
