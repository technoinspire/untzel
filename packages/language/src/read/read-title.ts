// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { TITLE_MAX_CODE_POINTS, isTitleTooLong, normalizeTitle } from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { LineIndex } from "./lines";
import { messages } from "../copy/messages";
import { readOutline, type StatementSyntax, type TitleSyntax } from "../highlight/outline";
import { parser } from "./parser";
// `title "…"`. The title never changes the sound, so
// an empty or long one is a warning and the program still plays; a second title line is
// an error, like a second `tempo`.
function isTitle(statement: StatementSyntax): statement is TitleSyntax {
  return statement.kind === "title";
}
/** The text between the quotes, with `\"` and `\\` read back. */
export function unquoteTitle(token: string): string {
  return token.slice(1, -1).replace(/\\(["\\])/g, "$1");
}
/** The normalized title, or null without a title line or with an empty one. */
export function readTitle(
  statements: readonly StatementSyntax[],
  lines: LineIndex,
  diagnostics: DiagnosticList,
): string | null {
  const [first, ...repeated] = statements.filter(isTitle);
  if (first === undefined) return null;
  for (const statement of repeated) {
    const message = messages.duplicateStatement("title", lines.lineNumber(first.from));
    diagnostics.error("DUPLICATE_STATEMENT", message, statement.head);
  }
  const written = unquoteTitle(first.value.text);
  const title = normalizeTitle(written);
  if (title === "") {
    diagnostics.warning("EMPTY_TITLE", messages.emptyTitle(), first.value);
    return null;
  }
  if (isTitleTooLong(written)) {
    diagnostics.warning("TITLE_TOO_LONG", messages.titleTooLong(TITLE_MAX_CODE_POINTS), first.value);
  }
  return title;
}
/**
 * The title of a text without analyzing the rest: the project list names a stored
 * project by it. null without a well-formed title line.
 */
export function titleOf(source: string): string | null {
  const lines = new LineIndex(source);
  const statement = readOutline(parser.parse(source), source, lines).find(isTitle);
  if (statement === undefined) return null;
  const title = normalizeTitle(unquoteTitle(statement.value.text));
  return title === "" ? null : title;
}
