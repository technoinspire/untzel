// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { DiagnosticList } from "../diagnostics/diagnostics";
import type { LineIndex } from "../read/lines";
import { renameFix } from "../diagnostics/fixes";
import { messages } from "../copy/messages";
import type { Token } from "../highlight/outline";

export interface TrackDeclaration {
  /** The written name, or null for the short form. */
  readonly name: Token | null;
  readonly instrument: string;
}

/** `base` when free, otherwise the first free `<base><n>` from 2. */
export function nextFreeName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The name of every track, in declaration order. Explicit names are reserved first;
 * then each unnamed track takes its instrument name or the next free numbered one.
 */
export function resolveTrackNames(declarations: readonly TrackDeclaration[]): readonly string[] {
  const taken = new Set(declarations.flatMap(({ name }) => (name === null ? [] : [name.text])));
  return declarations.map(({ name, instrument }) => {
    if (name !== null) return name.text;
    const assigned = nextFreeName(instrument, taken);
    taken.add(assigned);
    return assigned;
  });
}

/** Only repeated explicit names are an error; automatic names never collide. */
export function reportDuplicateTrackNames(
  declarations: readonly TrackDeclaration[],
  lines: LineIndex,
  diagnostics: DiagnosticList,
): void {
  const first = new Map<string, Token>();
  const taken = new Set(declarations.flatMap((declaration) => [declaration.name?.text ?? declaration.instrument]));
  for (const { name } of declarations) {
    if (name === null) continue;
    const earlier = first.get(name.text);
    if (earlier === undefined) {
      first.set(name.text, name);
      continue;
    }
    const next = nextFreeName(name.text, taken);
    taken.add(next);
    const message = messages.duplicateTrack(name.text, lines.lineNumber(earlier.from));
    diagnostics.error("DUPLICATE_TRACK_NAME", message, name, renameFix(name, next));
  }
}
