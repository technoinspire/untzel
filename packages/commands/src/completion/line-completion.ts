// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { COMMANDS, commandNamed, type ArgumentKind, type CommandSpec } from "../reading/catalog";
import { instrumentDetail, parameterDetail, signalExample } from "../proposal/describe";
import { assistStrings as say } from "../copy/copy";
import { SCALES, TONICS, type Vocabulary } from "../reading/vocabulary";
import { splitWords, type Word } from "../reading/words";

// Completion of the terminal's command line: the words that fit where the cursor is,
// a one-line usage hint and the ghost text of the first match.

export interface Completion {
  readonly label: string;
  readonly detail: string;
  /** What choosing it writes, when more than the label: "open 0" keeps the line valid. */
  readonly insert?: string;
}

export interface LineCompletion {
  /** The word under the cursor, in offsets of the line; a choice replaces it. */
  readonly from: number;
  readonly to: number;
  readonly options: readonly Completion[];
  /** "tempo <bpm> · 40 to 300"; null before a command is chosen. */
  readonly hint: string | null;
  /** What the first option adds after what is typed, shown dimmed. */
  readonly ghost: string;
}

/** Shown when the line is empty (state "vazio"). */
export const STARTER_COMMANDS: readonly string[] = ["help", "add", "tempo", "fix", "explain"];

function plain(labels: readonly string[], detail = ""): Completion[] {
  return labels.map((label) => ({ label, detail }));
}

interface Position {
  readonly words: readonly Word[];
  /** Index of the word being typed; words.length when the cursor follows a blank. */
  readonly index: number;
  readonly from: number;
  readonly to: number;
  readonly prefix: string;
}

function position(line: string, cursor: number): Position {
  const words = splitWords(line.slice(0, cursor));
  const last = words.at(-1);
  const typing = last !== undefined && last.to === cursor;
  const index = typing ? words.length - 1 : words.length;
  const from = typing ? last.from : cursor;
  const after = /^\S*/.exec(line.slice(cursor))?.[0] ?? "";
  return { words, index, from, to: cursor + after.length, prefix: typing ? last.text : "" };
}

function kindAt(spec: CommandSpec, argument: number): ArgumentKind | null {
  const kinds = spec.arguments;
  if (argument < kinds.length) return kinds[argument] ?? null;
  const last = kinds.at(-1);
  return last === "tracks" || last === "parts" || last === "value" ? last : null;
}

class LineCompleter {
  readonly #vocabulary: Vocabulary;
  readonly #source: string;

  constructor(vocabulary: Vocabulary, source: string) {
    this.#vocabulary = vocabulary;
    this.#source = source;
  }

  #names() {
    return this.#vocabulary.names(this.#source);
  }

  #instrumentOf(track: string | undefined): string {
    return this.#names().tracks.find((entry) => entry.name === track)?.instrument ?? "";
  }

  options(kind: ArgumentKind, words: readonly Word[], index: number): Completion[] {
    const names = this.#names();
    switch (kind) {
      case "command":
        return COMMANDS.map((command) => ({ label: command.name, detail: command.summary }));
      case "instrument":
        return this.#vocabulary.instruments().map((name) => ({ label: name, detail: instrumentDetail(this.#vocabulary.manifest(name)) }));
      case "track":
        return names.tracks.map((track) => ({ label: track.name, detail: track.instrument }));
      case "tracks": {
        const used = new Set(words.slice(2).map((word) => word.text));
        return names.tracks.filter((track) => !used.has(track.name)).map((track) => ({ label: track.name, detail: track.instrument }));
      }
      case "section":
        return plain(names.sections.map((section) => section.name), say.section);
      case "parts":
        // song intro 8, drop 16: even arguments are section names.
        return (index - 1) % 2 === 0 ? plain(names.sections.map((section) => section.name), say.section) : [];
      case "line-or-track":
        return [...plain(names.tracks.map((track) => track.name), say.track), ...plain(names.sections.map((section) => section.name), say.section)];
      case "tonic":
        return plain(TONICS, say.tonic);
      case "scale":
        return plain(SCALES, say.scale);
      case "loop-bars":
        return plain(["4", "8", "16"], say.bars);
      case "step-count":
        return plain(["8", "16", "32"], say.steps);
      case "pattern-bars":
        return plain(["1", "2", "4", "8", "16"], say.bars);
      case "parameter":
        return this.#vocabulary
          .parametersOf(this.#instrumentOf(words[1]?.text))
          .map((parameter) => ({ label: parameter.name, detail: parameterDetail(parameter) }));
      case "value":
        return this.#values(words[1]?.text, words[2]?.text, index);
      default:
        return [];
    }
  }

  #values(track: string | undefined, name: string | undefined, index: number): Completion[] {
    if (index !== 3) return [];
    const parameter = this.#vocabulary.parameter(this.#instrumentOf(track), name ?? "");
    if (parameter === undefined || parameter.kind === "flag") return [];
    if (parameter.kind === "choice") return plain(parameter.choices, parameter.name);
    const values = [parameter.example];
    if (parameter.allowsSignal) values.push(signalExample(parameter));
    return plain(values, parameterDetail(parameter));
  }

  /** While a parameter is being typed, `first` is the one the ghost text completes to. */
  hint(spec: CommandSpec, words: readonly Word[], index: number, first: string | undefined): string {
    const kind = index === 0 ? null : kindAt(spec, index - 1);
    if (kind === "bpm") return `${spec.usage} · ${say.tempoRange}`;
    const name = kind === "parameter" ? first : kind === "value" ? words[2]?.text : undefined;
    const parameter = name === undefined ? undefined : this.#vocabulary.parameter(this.#instrumentOf(words[1]?.text), name);
    if (parameter !== undefined) return `${spec.usage} · ${parameter.name} ${parameterDetail(parameter)}`;
    return `${spec.usage} · ${spec.summary}`;
  }
}

function ranked(options: readonly Completion[], prefix: string): Completion[] {
  const lower = prefix.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().startsWith(lower));
}

export function completeLine(line: string, cursor: number, vocabulary: Vocabulary, source: string): LineCompletion {
  const at = position(line, Math.min(Math.max(0, cursor), line.length));
  const completer = new LineCompleter(vocabulary, source);
  const spec = at.index === 0 ? undefined : commandNamed(at.words[0]?.text.toLowerCase() ?? "");
  const exact = at.index === 0 ? commandNamed(at.prefix.toLowerCase()) : undefined;
  const kind: ArgumentKind | null = at.index === 0 ? "command" : spec === undefined ? null : kindAt(spec, at.index - 1);
  const options = kind === null ? [] : ranked(completer.options(kind, at.words, at.index), at.prefix);
  const first = options[0]?.label ?? "";
  const hintSpec = spec ?? exact;
  const hint = hintSpec === undefined ? null : completer.hint(hintSpec, at.words, at.index, options[0]?.label);
  const ghost = at.prefix !== "" && first.toLowerCase().startsWith(at.prefix.toLowerCase()) ? first.slice(at.prefix.length) : "";
  return { from: at.from, to: at.to, options, hint, ghost };
}
