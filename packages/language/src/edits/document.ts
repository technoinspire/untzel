// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { LineIndex } from "../read/lines";
import { readOutline, type SectionSyntax, type SongSyntax, type StatementSyntax, type Token, type TrackSyntax } from "../highlight/outline";
import { parser } from "../read/parser";
import { resolveTrackNames } from "../vocabulary/track-names";
import type { TextChange } from "./text-changes";

/** A track line and the name the analysis gives it. */
export interface NamedTrack {
  readonly name: string;
  readonly syntax: TrackSyntax;
}

const BLANK = new Set([" ", "\t"]);

/**
 * The parsed source an edit works on. Edits only read it and return text changes, so
 * comments and formatting outside the touched tokens are kept as written.
 */
export class EditableSource {
  readonly source: string;
  readonly lines: LineIndex;
  readonly statements: readonly StatementSyntax[];
  readonly tracks: readonly NamedTrack[];
  /** The line break this source uses, for inserted lines. */
  readonly lineBreak: string;

  constructor(source: string) {
    this.source = source;
    this.lines = new LineIndex(source);
    this.statements = readOutline(parser.parse(source), source, this.lines);
    const syntax = this.statements.filter((statement): statement is TrackSyntax => statement.kind === "track");
    const names = resolveTrackNames(syntax.map((track) => ({ name: track.name, instrument: track.instrument.text })));
    this.tracks = syntax.map((track, index) => ({ name: names[index] ?? track.instrument.text, syntax: track }));
    this.lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
  }

  track(name: string): NamedTrack | null {
    return this.tracks.find((track) => track.name === name) ?? null;
  }

  trackNames(): ReadonlySet<string> {
    return new Set(this.tracks.map((track) => track.name));
  }

  sections(): readonly SectionSyntax[] {
    return this.statements.filter((statement): statement is SectionSyntax => statement.kind === "section");
  }

  song(): SongSyntax | null {
    return this.statements.find((statement): statement is SongSyntax => statement.kind === "song") ?? null;
  }

  /** Inserts a whole line after the line of `line`. */
  insertLineAfter(line: number, text: string): TextChange {
    const at = this.lines.range(line).to;
    return { from: at, to: at, insert: `${this.lineBreak}${text}` };
  }

  /** Inserts a whole line before the line of `line`. */
  insertLineBefore(line: number, text: string): TextChange {
    const at = this.lines.range(line).from;
    return { from: at, to: at, insert: `${text}${this.lineBreak}` };
  }

  /** Removes a whole line with its line break (the previous one on the last line). */
  removeLine(line: number): TextChange {
    const whole = this.lines.rangeWithBreak(line);
    const endsWithBreak = whole.to > whole.from && this.source[whole.to - 1] === "\n";
    if (endsWithBreak || whole.from === 0) return { from: whole.from, to: whole.to, insert: "" };
    const previousBreak = this.source[whole.from - 2] === "\r" ? 2 : 1;
    return { from: whole.from - previousBreak, to: whole.to, insert: "" };
  }

  /** Start of the blanks before `offset`. */
  blankStart(offset: number): number {
    let from = offset;
    while (from > 0 && BLANK.has(this.source[from - 1] ?? "")) from -= 1;
    return from;
  }

  /** Removes "| <modifier>" with the blanks before the bar. */
  removeModifier(modifier: { readonly from: number; readonly to: number }): TextChange {
    const bar = this.blankStart(modifier.from) - 1;
    const from = this.source[bar] === "|" ? this.blankStart(bar) : modifier.from;
    return { from, to: modifier.to, insert: "" };
  }

  /** Keeps the track names of a section that `keep` accepts, with their original spacing. */
  rewriteSectionTracks(section: SectionSyntax, keep: (token: Token) => boolean): TextChange {
    const first = section.tracks[0];
    const last = section.tracks[section.tracks.length - 1];
    if (first === undefined || last === undefined) return { from: section.name.to, to: section.name.to, insert: "" };
    let text = "";
    section.tracks.forEach((token, index) => {
      const previous = section.tracks[index - 1];
      const separator = previous === undefined ? "" : this.source.slice(previous.to, token.from);
      if (keep(token)) text += text === "" ? token.text : `${separator}${token.text}`;
    });
    return { from: first.from, to: last.to, insert: text };
  }
}
