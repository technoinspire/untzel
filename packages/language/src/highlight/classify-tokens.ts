// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Token classes for highlighting, read from the tree of the generated parser: the grammar
// stays the only definition of what each word is.
import type { SyntaxNode } from "@lezer/common";
import { LANGUAGE_FACTS } from "../vocabulary/facts";
import { parser } from "../read/parser";

export type TokenKind =
  | "keyword"
  | "track"
  | "instrument"
  | "section"
  | "hits"
  | "note"
  | "chord"
  | "number"
  | "signal"
  | "modifier"
  | "comment"
  | "punctuation";

/** A classified half-open range of the source, in UTF-16 offsets. */
export interface TokenSpan {
  readonly from: number;
  readonly to: number;
  readonly kind: TokenKind;
}

const PUNCTUATION: ReadonlySet<string> = new Set([":", "|", ",", "/", "?", "*", "[", "]", "(", ")", ".."]);
const KEYWORDS: ReadonlySet<string> = new Set(LANGUAGE_FACTS.keywords);
const SHAPES: ReadonlySet<string> = new Set(LANGUAGE_FACTS.signalShapes);
const BY_NAME: Readonly<Record<string, TokenKind>> = {
  Comment: "comment",
  Number: "number",
  Hits: "hits",
  Sustain: "hits",
  Note: "note",
  Tonic: "note",
  Chord: "chord",
};

/** A Name leaf: what it names depends on where the grammar put it. */
function nameKind(node: SyntaxNode): TokenKind | null {
  const parent = node.parent;
  switch (parent?.name) {
    case "TrackName":
      return "track";
    case "InstrumentName":
      return "instrument";
    case "ModifierName":
      return "modifier";
    case "Part":
      return "section";
    case "SectionDecl":
      return parent.firstChild?.nextSibling?.from === node.from ? "section" : "track";
    case "KeyStatement":
    case "Value":
      return "number";
    default:
      return null;
  }
}

function leafKind(node: SyntaxNode): TokenKind | null {
  const { name } = node;
  if (node.parent?.name === "ModifierName") return "modifier";
  if (SHAPES.has(name)) return "signal";
  if (KEYWORDS.has(name)) return "keyword";
  if (PUNCTUATION.has(name)) return "punctuation";
  if (name === "Name") return nameKind(node);
  return BY_NAME[name] ?? null;
}

/** Classified leaves in source order; unclassified text (spaces, errors) is left out. */
export function classifyTokens(source: string): readonly TokenSpan[] {
  const spans: TokenSpan[] = [];
  parser.parse(source).iterate({
    enter: (ref) => {
      const node = ref.node;
      if (node.firstChild !== null || node.from === node.to) return;
      const kind = leafKind(node);
      if (kind !== null) spans.push({ from: node.from, to: node.to, kind });
    },
  });
  return spans.sort((a, b) => a.from - b.from);
}

/** Named node types of the grammar that carry meaning (not Source, Line or the error node). */
export const GRAMMAR_NODE_TYPES: readonly string[] = parser.nodeSet.types
  .map((type) => type.name)
  .filter((name) => /^[A-Z]/.test(name) && name !== "Source" && name !== "Line");

/** Every named node type in the parse tree of a text. */
export function syntaxNodeTypes(source: string): ReadonlySet<string> {
  const names = new Set<string>();
  parser.parse(source).iterate({
    enter: (ref) => {
      if (!ref.type.isError) names.add(ref.name);
    },
  });
  return names;
}
