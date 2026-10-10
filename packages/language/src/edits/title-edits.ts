// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { normalizeTitle } from "@untzel/core";
import type { TitleSyntax } from "../highlight/outline";
import { EditableSource } from "./document";
import { applyChanges, failure, type EditResult } from "./text-changes";
/** `"…"` with `"` and `\` escaped, the only two escapes of the String token. */
export function quoteTitle(title: string): string {
  return `"${title.replace(/["\\]/g, (character) => `\\${character}`)}"`;
}
/**
 * The song title: replaces only the string of the first `title` line, or
 * inserts `title "…"` before the first statement, under the comments at the top (a
 * template's header stays first). The title is normalized here, so a received or typed
 * title can never break the line; empty after normalizing is INVALID_VALUE.
 */
export function setTitleEdit(source: string, title: string): EditResult {
  const normalized = normalizeTitle(title);
  if (normalized === "") return failure("INVALID_VALUE");
  const document = new EditableSource(source);
  const quoted = quoteTitle(normalized);
  const existing = document.statements.find((statement): statement is TitleSyntax => statement.kind === "title");
  if (existing !== undefined) {
    return applyChanges(source, [{ from: existing.value.from, to: existing.value.to, insert: quoted }]);
  }
  const line = `title ${quoted}`;
  const first = document.statements[0];
  if (first !== undefined) return applyChanges(source, [document.insertLineBefore(first.line, line)]);
  const separator = source === "" || source.endsWith("\n") ? "" : document.lineBreak;
  return applyChanges(source, [{ from: source.length, to: source.length, insert: `${separator}${line}` }]);
}
