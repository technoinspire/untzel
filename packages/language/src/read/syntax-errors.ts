// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Tree } from "@lezer/common";
import { noteNameToMidi } from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import type { LineIndex } from "./lines";
import { messages } from "../copy/messages";
import { noteFix } from "../vocabulary/note-spelling";
import { culpritWord, recoverLine, type ErrorLine } from "./syntax-recovery";

/** Lines with a syntax error, each mapped to the offset of its first error. */
export type ErroredLines = ReadonlyMap<number, number>;

const WORD = /^[A-Za-z0-9#_-]+/;
const NOTE_LIKE = /^[a-z][b#]?[0-9]+$/;
const MAX_SHOWN_TEXT = 20;

function wordAt(source: string, offset: number): { text: string; from: number } | null {
  let from = offset;
  while (source[from] === " " || source[from] === "\t") from += 1;
  const match = WORD.exec(source.slice(from));
  return match === null ? null : { text: match[0], from };
}

/** The generic diagnostic: INVALID_NOTE for a word shaped like a note, else `Unexpected`. */
function reportUnexpected(line: ErrorLine, to: number, diagnostics: DiagnosticList): void {
  const { source, errorFrom: from, lineEnd } = line;
  const word = wordAt(source, from);
  if (word !== null && NOTE_LIKE.test(word.text) && noteNameToMidi(word.text) === null) {
    const token = { text: word.text, from: word.from, to: word.from + word.text.length };
    const { suggestion, fix } = noteFix(token);
    diagnostics.error("INVALID_NOTE", messages.invalidNote(word.text, suggestion), token, fix);
    return;
  }
  // The word the error starts in, whole ("xylo", not "ylo"); the token after it otherwise.
  const culprit = culpritWord(line);
  if (culprit !== null) {
    diagnostics.error("SYNTAX_ERROR", messages.unexpected(culprit.text.slice(0, MAX_SHOWN_TEXT)), culprit);
    return;
  }
  if (to > from) {
    const text = source.slice(from, to).trim().slice(0, MAX_SHOWN_TEXT);
    diagnostics.error("SYNTAX_ERROR", messages.unexpected(text), { from, to });
    return;
  }
  if (word !== null && word.from < lineEnd) {
    const range = { from: word.from, to: Math.min(lineEnd, word.from + word.text.length) };
    diagnostics.error("SYNTAX_ERROR", messages.unexpected(word.text), range);
    return;
  }
  if (from >= lineEnd) {
    diagnostics.error("SYNTAX_ERROR", messages.unexpectedEnd(), { from: Math.max(0, from - 1), to: from });
    return;
  }
  diagnostics.error("SYNTAX_ERROR", messages.unexpected(source.slice(from, from + 1)), { from, to: from + 1 });
}

/**
 * One diagnostic per physical line with an error node, anchored on the word that caused
 * it: a reading of what was meant (syntax-recovery.ts) when there is one, else the
 * generic INVALID_NOTE or SYNTAX_ERROR.
 */
export function findSyntaxErrors(
  tree: Tree,
  source: string,
  lines: LineIndex,
  diagnostics: DiagnosticList,
  instruments: ReadonlySet<string>,
): ErroredLines {
  const errored = new Map<number, number>();
  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) return;
      const line = lines.lineOf(node.from);
      if (errored.has(line)) return;
      errored.set(line, node.from);
      const { from: lineStart, to: lineEnd } = lines.range(line);
      const errorLine: ErrorLine = { source, lineStart, lineEnd, errorFrom: node.from, instruments };
      const recovery = recoverLine(errorLine);
      if (recovery === null) reportUnexpected(errorLine, node.to, diagnostics);
      else diagnostics.error(recovery.code, recovery.message, recovery.range, recovery.fix);
    },
  });
  return errored;
}
