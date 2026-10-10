// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The closed list of terminal commands.
// English and stable: they are part of the documented interface.

import { commandSummaries } from "../copy/copy";

/** What a word of a command stands for: drives completion, hints and help. */
export type ArgumentKind =
  | "command"
  | "instrument"
  | "track"
  | "new-name"
  | "bpm"
  | "tonic"
  | "scale"
  | "loop-bars"
  | "parameter"
  | "value"
  | "tone"
  | "step-count"
  | "pattern-bars"
  | "section"
  | "tracks"
  | "parts"
  | "line-or-track";

export interface CommandSpec {
  readonly name: string;
  readonly usage: string;
  /** One short line for help and the usage hint, in the current language. */
  readonly summary: string;
  readonly example: string;
  /** In order; the last kind repeats for "tracks" and "parts". */
  readonly arguments: readonly ArgumentKind[];
}

type CommandName = keyof typeof commandSummaries;

function spec(name: CommandName, usage: string, example: string, ...args: ArgumentKind[]): CommandSpec {
  return {
    name,
    usage,
    get summary() {
      return commandSummaries[name];
    },
    example,
    arguments: args,
  };
}

export const COMMANDS: readonly CommandSpec[] = [
  spec("help", "help [command]", "help set", "command"),
  spec("add", "add <instrument> [name]", "add bass", "instrument", "new-name"),
  spec("duplicate", "duplicate <track>", "duplicate bass", "track"),
  spec("remove", "remove <track>", "remove ride", "track"),
  spec("rename", "rename <track> <new>", "rename bass acid", "track", "new-name"),
  spec("mute", "mute <track>", "mute hat", "track"),
  spec("unmute", "unmute <track>", "unmute hat", "track"),
  spec("solo", "solo <track>", "solo bass", "track"),
  spec("tempo", "tempo <bpm>", "tempo 124", "bpm"),
  spec("key", "key <tonic> <scale>", "key a minor", "tonic", "scale"),
  spec("loop", "loop <bars>", "loop 8", "loop-bars"),
  spec("set", "set <track> <param> <value>", "set bass cutoff sine(8) 300..2400", "track", "parameter", "value"),
  spec("tone", "tone <track> <value>", "tone bass 0.7", "track", "tone"),
  spec("steps", "steps <track> <8|16|32>", "steps hat 32", "track", "step-count"),
  spec("bars", "bars <track> <n>", "bars bass 4", "track", "pattern-bars"),
  spec("section", "section <name> <tracks…>", "section drop kick hat bass", "section", "tracks"),
  spec("song", "song <part bars, …>", "song intro 8, drop 16", "parts"),
  spec("play", "play", "play"),
  spec("stop", "stop", "stop"),
  spec("drop", "drop", "drop"),
  spec("fix", "fix", "fix"),
  spec("explain", "explain <line|track>", "explain bass", "line-or-track"),
  spec("undo", "undo", "undo"),
  spec("redo", "redo", "redo"),
  spec("clear", "clear", "clear"),
];

export function commandNamed(name: string): CommandSpec | undefined {
  return COMMANDS.find((command) => command.name === name);
}

export const COMMAND_NAMES: readonly string[] = COMMANDS.map((command) => command.name);
